import boto3
import json
import os
import traceback
from decimal import Decimal
from datetime import datetime, timezone, timedelta
from boto3.dynamodb.conditions import Key, Attr

def chunk_list(lst, n):
    for i in range(0, len(lst), n):
        yield lst[i:i + n]

# 自定義 JSON 編碼器，處理 DynamoDB 的 Decimal 型別
class DecimalEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            # 將 Decimal 轉為 int 或 float
            if obj % 1 == 0:
                return int(obj)
            else:
                return float(obj)
        return super(DecimalEncoder, self).default(obj)

# 初始化 DynamoDB 客戶端
# 使用 resource 層級以便於操作
dynamodb = boto3.resource('dynamodb')

# 定義所有感測器類型 (來自設計文件與 timestreamProcessor)
SENSOR_TYPES = [
    "weight1", "weight2", 
    "Temperature", "Humidity", "CO2", "NH3",
    "ACMotor", "BatVoltage", "CBoardPD", "FanMotorIN", "FanMotorOUT", "rssi"
]

def handler(event, context):
    print(f"DEBUG: Received event: {json.dumps(event)}")
    # CORS Preflight check
    if event.get('httpMethod') == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'OPTIONS,GET'
            },
            'body': ''
        }

    query_params = event.get('queryStringParameters') or {}
    req_type = query_params.get('type', 'latest')
    
    if req_type == 'history':
        return handle_history(query_params)
    else:
        return handle_latest()

def handle_history(params):
    table_name = os.environ.get('STORAGE_SENSORDATACACHE_NAME')
    table = dynamodb.Table(table_name)
    days_str = params.get('days', '1')
    dev_id = params.get('devID', 'FoodWasteDecomposer000002')
    sensor_type = params.get('sensorType', 'weight1') # 獲取要求的感測器類型
    
    try:
        days = int(days_str)
        now = datetime.now(timezone.utc)
        
        history_data = []
        # Iterate through the requested number of days
        for i in range(days):
            target_date = (now - timedelta(days=i)).strftime('%Y-%m-%d')
            pk = f"DEVICE#{dev_id}#DATE#{target_date}"
            
            # 關鍵優化：直接在查詢時過濾 Sort Key (sensorType)
            # 這樣 DynamoDB 就只會回傳我們要的那種感測器數據
            query_params = {
                'KeyConditionExpression': Key('cache_key').eq(pk) & Key('timestamp_sk').begins_with(f"SENSOR#{sensor_type}#")
            }
            
            while True:
                response = table.query(**query_params)
                # 只提取必要的欄位以減少傳輸體積
                for item in response.get('Items', []):
                    history_data.append({
                        'sensorType': item.get('sensorType'),
                        'value': item.get('value'),
                        'timestamp': item.get('timestamp')
                    })
                
                last_evaluated_key = response.get('LastEvaluatedKey')
                if not last_evaluated_key:
                    break
                query_params['ExclusiveStartKey'] = last_evaluated_key
            
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*', 
                'Content-Type': 'application/json'
            },
            'body': json.dumps({'history': history_data}, cls=DecimalEncoder)
        }
    except Exception as e:
        print(f"ERROR in handle_history: {str(e)}")
        return {
            'statusCode': 500, 
            'headers': {'Access-Control-Allow-Origin': '*'}, 
            'body': json.dumps({'error': str(e)})
        }

import concurrent.futures

def fetch_latest_for_device(table, devID, today_str, yesterday_str):
    """助手函式：一次性獲取單個設備的所有感測器最新值"""
    latest_map = {}
    # 嘗試今天和昨天，確保抓到數據
    for date_str in [today_str, yesterday_str]:
        pk = f"DEVICE#{devID}#DATE#{date_str}"
        # 查詢該分區的所有數據，按時間倒序
        # 我們不帶 BeginsWith，直接抓該天所有 SENSOR 數據
        query_params = {
            'KeyConditionExpression': Key('cache_key').eq(pk) & Key('timestamp_sk').begins_with("SENSOR#"),
            'ScanIndexForward': False 
        }
        res = table.query(**query_params)
        for item in res.get('Items', []):
            s_type = item.get('sensorType')
            # 只有當我們還沒抓到該感測器的最新值時才存入
            if s_type and s_type not in latest_map:
                latest_map[s_type] = {
                    'devID': item.get('devID'), 
                    'sensorType': s_type, 
                    'value': item.get('value'), 
                    'time': item.get('timestamp')
                }
        # 如果今天已經抓到了大部分感測器，可以考慮不再翻昨天的，或者繼續補充
        # 這裡為了效能，如果抓到資料就 break，或者看情況
    return list(latest_map.values())

def handle_latest():
    try:
        table_name = os.environ.get('STORAGE_SENSORDATACACHE_NAME')
        table = dynamodb.Table(table_name)
        now = datetime.now(timezone.utc)
        today_str = now.strftime('%Y-%m-%d')
        yesterday_str = (now - timedelta(days=1)).strftime('%Y-%m-%d')
        
        # 1. 找設備 (使用 GSI 優化，從 19s 降到 <1s)
        # 統一不帶微秒，確保字串比較一致
        search_time = (now - timedelta(hours=1)).replace(microsecond=0)
        search_prefix = search_time.isoformat()
        
        dev_ids = set()
        
        # 定義查詢函式，避免重複代碼
        def query_devices_for_date(target_date, min_ts):
            found = set()
            query_params = {
                'IndexName': 'date-timestamp-index',
                'KeyConditionExpression': Key('date').eq(target_date) & Key('timestamp').gte(min_ts),
                'ProjectionExpression': "cache_key" # cache_key 作為表主鍵，必定存在於 GSI 中
            }
            while True:
                response = table.query(**query_params)
                for item in response.get('Items', []):
                    # 從 DEVICE#BBox01#DATE#... 解析出 devID
                    pk_parts = item.get('cache_key', '').split('#')
                    if len(pk_parts) > 1:
                        found.add(pk_parts[1])
                if 'LastEvaluatedKey' not in response: break
                query_params['ExclusiveStartKey'] = response['LastEvaluatedKey']
            return found

        # 查詢今天
        dev_ids.update(query_devices_for_date(today_str, search_prefix))
        
        # 如果一小時前的時間點是在昨天，則也查詢昨天的資料
        if search_time.date() < now.date():
            dev_ids.update(query_devices_for_date(yesterday_str, search_prefix))
        
        if not dev_ids:
            # 回退邏輯... (略過詳細重複掃描，直接用昨天的 cache_key 判斷)
            dev_ids = ['BBox01'] # 保持最低限度備援

        latest_records = []
        # 2. 並行獲取每個設備的所有數據 (Parallel Discovery)
        with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
            future_to_dev = {executor.submit(fetch_latest_for_device, table, devID, today_str, yesterday_str): devID for devID in dev_ids}
            for future in concurrent.futures.as_completed(future_to_dev):
                latest_records.extend(future.result())

        # 重組分組數據...
        data_grouped = {}
        for rec in latest_records:
            d_id = rec['devID']
            if d_id not in data_grouped: data_grouped[d_id] = []
            data_grouped[d_id].append(rec)

        response_body = json.dumps({
            'data': {
                'LATEST': latest_records,
                **data_grouped
            }, 
            'last_updated': now.isoformat()
        }, cls=DecimalEncoder)

        return {
            'statusCode': 200,
            'headers': {'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json'},
            'body': response_body
        }
    except Exception as e:
        print(f"CRITICAL ERROR in handle_latest: {str(e)}")
        print(traceback.format_exc())
        return {
            'statusCode': 500,
            'headers': {'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json'},
            'body': json.dumps({'error': 'Internal Server Error', 'details': str(e)})
        }
