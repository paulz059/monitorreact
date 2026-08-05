import boto3
import json
import os
import time
from datetime import datetime, timezone
from collections import defaultdict
from decimal import Decimal

# Environmental configuration with portability fallbacks
REGION = os.environ.get('AWS_REGION', 'ap-southeast-2')
TIMESTREAM_DB = os.environ.get('TIMESTREAM_DATABASE_NAME', 'BBox01TestSampleDB')
TIMESTREAM_TABLE = os.environ.get('TIMESTREAM_TABLE_NAME', 'LiveData')

# 初始化 AWS 客戶端
# Timestream query client
query_client = boto3.client('timestream-query', region_name=REGION)
# DynamoDB resource
dynamodb = boto3.resource('dynamodb', region_name=REGION)

# Sensor categorization based on design plan
AGGREGATE_SENSORS = {'weight1', 'weight2'}
CRITICAL_SENSORS = {'Temperature', 'Humidity', 'CO2', 'NH3', 'rssi'}
MAINTENANCE_SENSORS = {'ACMotor', 'BatVoltage', 'CBoardPD', 'FanMotorIN', 'FanMotorOUT', 'GPS', 'TiltDetect', 'RollMotor', 'value'}

def handler(event, context):
    """
    Lambda handler for processing raw Timestream data and caching it in DynamoDB.
    Stores raw data points every 30m for frontend-side aggregation.
    """
    table_name = os.environ.get('STORAGE_SENSORDATACACHE_NAME')
    if not table_name:
        return {'statusCode': 500, 'body': json.dumps('Error: Table name not set')}

    table = dynamodb.Table(table_name)
    now = datetime.now(timezone.utc)
    
    # Define sensors to fetch
    sensors_to_fetch = AGGREGATE_SENSORS | CRITICAL_SENSORS
    if now.minute < 30:
        sensors_to_fetch |= MAINTENANCE_SENSORS

    sensor_list_str = ", ".join([f"'{s}'" for s in sensors_to_fetch])

    try:
        # Fetch RAW data from the last 40 minutes (to ensure coverage of the 30m window)
        raw_query = f"""
            SELECT devID, measure_name, 
                   TRY_CAST("measure_value::varchar" AS DOUBLE) as val, 
                   time
            FROM "{TIMESTREAM_DB}"."{TIMESTREAM_TABLE}"
            WHERE time > ago(40m)
            AND measure_name IN ({sensor_list_str})
            ORDER BY time DESC
        """
        raw_results = run_query(raw_query)

        # --- DYNAMODB WRITES (Time-Series Pattern) ---
        # TTL: Calculate expiration time (7 days from now) in Unix epoch seconds
        expire_at = int(time.time() + (7 * 24 * 60 * 60))
        
        with table.batch_writer() as batch:
            for row in raw_results:
                if 'measure_name' in row and row.get('val') is not None:
                    # Parse timestamp to get date for partitioning
                    ts_str = row['time'] # e.g. "2026-05-20 10:30:00.000000000"
                    dt_obj = datetime.strptime(ts_str.split('.')[0], '%Y-%m-%d %H:%M:%S').replace(tzinfo=timezone.utc)
                    date_str = dt_obj.strftime('%Y-%m-%d')
                    
                    # New Logical Partitioning:
                    # PK: DEVICE#<devID>#DATE#<YYYY-MM-DD>
                    # SK: SENSOR#<sensorType>#TS#<ISO_Timestamp>
                    batch.put_item(Item={
                        'cache_key': f"DEVICE#{row['devID']}#DATE#{date_str}", # Partition Key
                        'timestamp_sk': f"SENSOR#{row['measure_name']}#TS#{dt_obj.isoformat()}", # Sort Key
                        'date': date_str, # 用於 GSI 優化查詢
                        'devID': row['devID'],
                        'sensorType': row['measure_name'],
                        'value': float_to_decimal(row['val']),
                        'timestamp': dt_obj.isoformat(),
                        'type': 'RAW_DATA',
                        'updated_at': now.isoformat(),
                        'expire_at': expire_at # TTL field for auto-deletion
                    })

        return {
            'statusCode': 200,
            'body': json.dumps({'message': f'Success. Processed {len(raw_results)} raw data points.'})
        }
        
    except Exception as e:
        print(f"Error in timestreamProcessor: {str(e)}")
        return {'statusCode': 500, 'body': json.dumps(f"Error: {str(e)}")}

def run_query(query_string):
    """Executes a Timestream query and returns a list of parsed dictionaries."""
    results = []
    paginator = query_client.get_paginator('query')
    page_iterator = paginator.paginate(QueryString=query_string)
    for page in page_iterator:
        column_info = page['ColumnInfo']
        for row in page['Rows']:
            results.append(parse_row(column_info, row))
    return results

def parse_row(column_info, row):
    """Parses a Timestream row into a dictionary, handling NULLs and types."""
    data = {}
    data_row = row['Data']
    for i in range(len(column_info)):
        column = column_info[i]
        value = data_row[i]
        column_name = column['Name']
        
        if value.get('NullValue'):
            data[column_name] = None
        elif 'ScalarValue' in value:
            data[column_name] = value['ScalarValue']
        elif 'TimeSeriesValue' in value:
            data[column_name] = value['TimeSeriesValue']
        elif 'ArrayValue' in value:
            data[column_name] = value['ArrayValue']
        elif 'RowValue' in value:
            data[column_name] = value['RowValue']
        else:
            data[column_name] = None
    return data

def float_to_decimal(value):
    """Converts numeric values to Decimal for DynamoDB storage."""
    if value is None:
        return None
    try:
        # Convert through string to avoid float precision issues
        return Decimal(str(value))
    except:
        return value
