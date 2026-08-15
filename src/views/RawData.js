import React, { useState, useEffect } from "react";
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
  Alert
} from "reactstrap";
import { useLanguage } from "contexts/LanguageContext";

const SENSOR_TYPES = [
  "weight1", "weight2", "Temperature", "Humidity", "CO2", "NH3", "rssi",
  "ACMotor", "BatVoltage", "CBoardPD", "FanMotorIN", "FanMotorOUT",
  "GPS", "TiltDetect", "RollMotor", "value"
];

function getLastMonthRange() {
  const now = new Date();
  const firstOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthEnd = new Date(firstOfThisMonth.getTime() - 1);
  const lastMonthStart = new Date(lastMonthEnd.getFullYear(), lastMonthEnd.getMonth(), 1);
  return { start: lastMonthStart, end: lastMonthEnd };
}

function formatMonthLabel(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function RawData() {
  const { t } = useLanguage();
  const [devIDs, setDevIDs] = useState([]);
  const [selectedDevID, setSelectedDevID] = useState("");
  const [selectedSensorType, setSelectedSensorType] = useState(SENSOR_TYPES[0]);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadDeviceList = async () => {
      try {
        const restOperation = get({
          apiName: 'monitorApi',
          path: '/data',
          options: { queryParams: { type: 'latest' } }
        });
        const { body } = await restOperation.response;
        const response = await body.json();
        const records = (response && response.data && response.data.LATEST) || [];
        const ids = Array.from(new Set(records.map(r => r.devID))).sort();
        setDevIDs(ids);
      } catch (err) {
        console.error("Error loading device list:", err);
      }
    };
    loadDeviceList();
  }, []);

  const handleExport = async () => {
    if (!selectedDevID) return;
    setError(null);
    setExporting(true);
    try {
      const { start, end } = getLastMonthRange();
      const now = new Date();
      const daysBack = Math.ceil((now - start) / (1000 * 60 * 60 * 24)) + 1;

      const restOperation = get({
        apiName: 'monitorApi',
        path: '/data',
        options: {
          queryParams: {
            type: 'history',
            sensorType: selectedSensorType,
            days: daysBack.toString(),
            devID: selectedDevID
          }
        }
      });
      const { body } = await restOperation.response;
      const response = await body.json();
      const allRecords = response.history || [];

      const filtered = allRecords.filter(rec => {
        if (!rec.timestamp) return false;
        const recDate = new Date(rec.timestamp);
        return recDate >= start && recDate <= end;
      });

      const exportPayload = { [selectedSensorType]: filtered };
      const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${selectedDevID}_${selectedSensorType}_${formatMonthLabel(start)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error exporting raw data:", err);
      setError('rawData.errorExport');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="content">
      {error && (
        <Alert color="danger" toggle={() => setError(null)}>
          {t(error)}
        </Alert>
      )}
      <Row>
        <Col md="12">
          <Card>
            <CardHeader>
              <CardTitle tag="h2">{t('rawData.title')}</CardTitle>
              <p className="text-muted">{t('rawData.subtitle')}</p>
            </CardHeader>
            <CardBody>
              <Row>
                <Col md="4">
                  <FormGroup>
                    <Label for="devSelect" className="text-dark">{t('rawData.selectDevice')}</Label>
                    <Input
                      type="select"
                      id="devSelect"
                      value={selectedDevID}
                      onChange={(e) => setSelectedDevID(e.target.value)}
                      className="bg-white text-dark border-info"
                    >
                      <option value="">{t('rawData.chooseDevice')}</option>
                      {devIDs.map(id => (
                        <option key={id} value={id}>{id}</option>
                      ))}
                    </Input>
                  </FormGroup>
                </Col>
                <Col md="4">
                  <FormGroup>
                    <Label for="sensorTypeSelect" className="text-dark">{t('rawData.selectSensorType')}</Label>
                    <Input
                      type="select"
                      id="sensorTypeSelect"
                      value={selectedSensorType}
                      onChange={(e) => setSelectedSensorType(e.target.value)}
                      className="bg-white text-dark border-info"
                    >
                      {SENSOR_TYPES.map(sensorType => (
                        <option key={sensorType} value={sensorType}>{sensorType}</option>
                      ))}
                    </Input>
                  </FormGroup>
                </Col>
                <Col md="4" className="d-flex align-items-end">
                  <button
                    className="btn btn-info w-100"
                    onClick={handleExport}
                    disabled={!selectedDevID || exporting}
                  >
                    {exporting ? <Spinner size="sm" /> : t('rawData.exportLastMonth')}
                  </button>
                </Col>
              </Row>
            </CardBody>
          </Card>
        </Col>
      </Row>
    </div>
  );
}

export default RawData;
