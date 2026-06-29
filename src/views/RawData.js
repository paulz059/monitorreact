import React, { useState, useEffect, useMemo } from "react";
import { get } from 'aws-amplify/api';
import {
  Card,
  CardHeader,
  CardBody,
  CardTitle,
  Row,
  Col,
  Spinner,
  FormGroup,
  Label,
  Input,
  Badge
} from "reactstrap";

function RawData() {
  const [loading, setLoading] = useState(true);
  const [rawData, setRawData] = useState({});
  const [selectedDevID, setSelectedDevID] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const restOperation = get({ 
        apiName: 'monitorApi', 
        path: '/data' 
      });
      const { body } = await restOperation.response;
      const response = await body.json();
      if (response && response.data) {
        setRawData(response.data);
      }
    } catch (err) {
      console.error("Error fetching raw data:", err);
    } finally {
      setLoading(false);
    }
  };

  // 將資料按 devID 分組
  const devicesData = useMemo(() => {
    const groups = {};
    Object.entries(rawData).forEach(([msgID, records]) => {
      records.forEach(record => {
        const { devID } = record;
        if (!groups[devID]) {
          groups[devID] = [];
        }
        groups[devID].push({
          msgID,
          ...record
        });
      });
    });
    // 按時間降序排序（最新的在上面）
    Object.keys(groups).forEach(id => {
      groups[id].sort((a, b) => new Date(b.time) - new Date(a.time));
    });
    return groups;
  }, [rawData]);

  const devIDs = Object.keys(devicesData).sort();

  useEffect(() => {
    if (!selectedDevID && devIDs.length > 0) {
      setSelectedDevID(devIDs[0]);
    }
  }, [devIDs, selectedDevID]);

  return (
    <div className="content">
      <Row>
        <Col md="12">
          <Card>
            <CardHeader>
              <Row className="align-items-center">
                <Col md="8">
                  <CardTitle tag="h2">RAW 資料查詢</CardTitle>
                  <p className="text-muted">檢視資料庫回傳的原始 JSON 數據</p>
                </Col>
                <Col md="4" className="text-right">
                  <button className="btn btn-info btn-sm" onClick={fetchData} disabled={loading}>
                    {loading ? <Spinner size="sm" /> : "重新整理"}
                  </button>
                </Col>
              </Row>
            </CardHeader>
            <CardBody>
              <FormGroup>
                <Label for="devSelect" className="text-white">選擇設備 (devID)</Label>
                <Input 
                  type="select" 
                  id="devSelect"
                  value={selectedDevID}
                  onChange={(e) => setSelectedDevID(e.target.value)}
                  className="bg-dark text-white border-info"
                >
                  <option value="">-- 請選擇設備 --</option>
                  {devIDs.map(id => (
                    <option key={id} value={id}>{id}</option>
                  ))}
                </Input>
              </FormGroup>
            </CardBody>
          </Card>
        </Col>
      </Row>

      <Row>
        <Col md="12">
          {loading ? (
            <div className="text-center p-5"><Spinner color="info" /></div>
          ) : (
            selectedDevID && devicesData[selectedDevID] ? (
              devicesData[selectedDevID].map((record, index) => (
                <Card key={index} className="mb-3 bg-dark border-secondary">
                  <CardHeader className="py-2">
                    <div className="d-flex justify-content-between align-items-center">
                      <Badge color="info">Msg ID: {record.msgID}</Badge>
                      <small className="text-muted">{new Date(record.time).toLocaleString()}</small>
                    </div>
                  </CardHeader>
                  <CardBody className="py-2">
                    <pre style={{ 
                      backgroundColor: "#1e1e2f", 
                      color: "#00d6b4", 
                      padding: "15px", 
                      borderRadius: "5px",
                      fontSize: "13px",
                      overflowX: "auto"
                    }}>
                      {JSON.stringify(record, null, 2)}
                    </pre>
                  </CardBody>
                </Card>
              ))
            ) : (
              <div className="text-center p-5 text-muted">目前沒有資料</div>
            )
          )}
        </Col>
      </Row>
    </div>
  );
}

export default RawData;
