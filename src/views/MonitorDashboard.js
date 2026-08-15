import React, { useState, useEffect, useMemo, useCallback } from "react";
import { get } from 'aws-amplify/api';
import { Line } from "react-chartjs-2";
import {
  Card,
  CardHeader,
  CardBody,
  CardTitle,
  Row,
  Col,
  Table,
  Spinner,
  Badge,
  FormGroup,
  Label,
  Input,
  Alert
} from "reactstrap";
import { useLanguage } from "contexts/LanguageContext";

const UNKNOWN_LAST_UPDATED = "__unknown__";

// 5. 主儀表板畫面
function MonitorDashboard() {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [error, setError] = useState(null);
  const [rawData, setRawData] = useState({}); 
  const [historyData, setHistoryData] = useState(null);
  const [weight1History, setWeight1History] = useState([]);
  const [weight2History, setWeight2History] = useState([]);
  const [lastUpdated, setLastUpdated] = useState("");
  const [selectedDevID, setSelectedDevID] = useState("");
  const [weightTrendDays, setWeightTrendDays] = useState("7");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const restOperation = get({ 
        apiName: 'monitorApi', 
        path: '/data',
        options: { queryParams: { type: 'latest' } }
      });
      
      const { body } = await restOperation.response;
      const response = await body.json();
      
      if (response && response.data && response.data.LATEST) {
        const transformedData = { 'B-BOX-01': response.data.LATEST };
        setRawData(transformedData);
        setLastUpdated(response.last_updated || UNKNOWN_LAST_UPDATED);
      }
    } catch (err) {
      console.error("Error fetching data:", err);
      setError("monitorDashboard.errorLoad");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSensorHistory = useCallback(async (sensorType, limitDays = '7') => {
    if (!selectedDevID) return [];
    try {
      const restOperation = get({ 
        apiName: 'monitorApi', 
        path: '/data',
        options: { 
          queryParams: { 
            type: 'history', 
            sensorType: sensorType, 
            days: limitDays,
            devID: selectedDevID
          } 
        }
      });
      const { body } = await restOperation.response;
      const response = await body.json();
      return response.history || [];
    } catch (err) {
      console.error(`Error fetching history for ${sensorType}:`, err);
      return [];
    }
  }, [selectedDevID]);

  // CONTAINER WEIGHT TREND 圖表資料抓取 (固定 weight2，天數可切換 7/15/30)
  useEffect(() => {
    const loadMainHistory = async () => {
      if (!selectedDevID) return;
      setLoadingHistory(true);
      const data = await fetchSensorHistory("weight2", weightTrendDays);
      setHistoryData(data);
      setLoadingHistory(false);
    };
    loadMainHistory();
  }, [weightTrendDays, selectedDevID, fetchSensorHistory]);

  // 今日與週加總資料抓取 (weight1 & weight2)
  useEffect(() => {
    const loadWeightSums = async () => {
      if (!selectedDevID) return;
      // 改為抓取 7 天以支援週圖表
      const [w1, w2] = await Promise.all([
        fetchSensorHistory('weight1', '7'),
        fetchSensorHistory('weight2', '7')
      ]);
      setWeight1History(w1);
      setWeight2History(w2);
    };
    loadWeightSums();
  }, [selectedDevID, fetchSensorHistory]);

  // Weight parameters are now retrieved from the latest device sensor reading directly

  const weightChartData = useMemo(() => {
    if (!historyData || historyData.length === 0) {
      return {
        labels: [],
        datasets: [{
          label: 'No data available',
          data: [],
          borderColor: "#c0c0c0",
          backgroundColor: "rgba(192,192,192,0.2)",
          fill: true
        }]
      };
    }
    
    const filteredData = historyData.filter(item => item.sensorType === "weight2");

    // 取每日最後一筆紀錄 (依 timestamp 判斷)
    const dailyLastRecord = filteredData.reduce((acc, item) => {
      const parsedValue = parseFloat(item.value || 0);
      if (!Number.isFinite(parsedValue)) return acc;
      const date = item.timestamp ? item.timestamp.split('T')[0] : (item.date || "Unknown");
      const currentTime = item.timestamp || item.date || "";
      if (!acc[date] || currentTime >= acc[date].time) {
        acc[date] = { value: parsedValue, time: currentTime };
      }
      return acc;
    }, {});

    const sortedDates = Object.keys(dailyLastRecord).sort();
    const values = sortedDates.map(date => dailyLastRecord[date].value.toFixed(2));

    return {
      labels: sortedDates,
      datasets: [{
        label: `weight2 (${weightTrendDays} days)`,
        data: values,
        borderColor: "#c0c0c0",
        backgroundColor: "rgba(192,192,192,0.2)",
        fill: true,
        tension: 0.4
      }]
    };
  }, [historyData, weightTrendDays]);

  const reductionChartData = useMemo(() => {
    if (!weight1History || weight1History.length === 0 || !weight2History || weight2History.length === 0) {
      return {
        labels: [],
        datasets: [{
          label: 'No data available',
          data: [],
          borderColor: "#787878",
          backgroundColor: "rgba(120,120,120,0.2)",
          fill: true
        }]
      };
    }

    const weight1Daily = weight1History.reduce((acc, item) => {
      const parsedValue = parseFloat(item.value || 0);
      if (!Number.isFinite(parsedValue)) return acc;
      const date = item.timestamp ? item.timestamp.split('T')[0] : (item.date || "Unknown");
      if (!acc[date]) acc[date] = 0;
      acc[date] += parsedValue;
      return acc;
    }, {});

    const weight2Daily = weight2History.reduce((acc, item) => {
      const parsedValue = parseFloat(item.value || 0);
      if (!Number.isFinite(parsedValue)) return acc;
      const date = item.timestamp ? item.timestamp.split('T')[0] : (item.date || "Unknown");
      if (!acc[date]) acc[date] = 0;
      acc[date] += parsedValue;
      return acc;
    }, {});

    const allDates = Array.from(new Set([
      ...Object.keys(weight1Daily),
      ...Object.keys(weight2Daily)
    ])).sort();

    const values = allDates.map(date => {
      const w1 = weight1Daily[date] || 0;
      const w2 = weight2Daily[date] || 0;
      const biomassOut = w2 / 15;
      const reduction = (w1 * 1.5) + (biomassOut * 0.9635);
      return reduction.toFixed(2);
    });

    return {
      labels: allDates,
      datasets: [{
        label: "Daily Reduction (kg)",
        data: values,
        borderColor: "#787878",
        backgroundColor: "rgba(120,120,120,0.2)",
        fill: true,
        tension: 0.4
      }]
    };
  }, [weight1History, weight2History]);

  const totalReduction7Days = useMemo(() => {
    if (!reductionChartData || !reductionChartData.datasets || reductionChartData.datasets[0].data.length === 0) {
      return "0.00";
    }
    const sum = reductionChartData.datasets[0].data.reduce((acc, val) => acc + parseFloat(val || 0), 0);
    return sum.toFixed(2);
  }, [reductionChartData]);

  const devices = useMemo(() => {
    if (!rawData || !rawData['B-BOX-01']) return [];
    
    const devicesMap = {};
    
    rawData['B-BOX-01'].forEach(record => {
      const { devID, sensorType, value, time } = record;
      
      if (!devicesMap[devID]) {
        devicesMap[devID] = {
          devID: devID,
          lastMsgID: "N/A",
          lastTime: "1970-01-01T00:00:00Z",
          sensors: {}
        };
      }
      
      devicesMap[devID].sensors[sensorType] = value;
      if (new Date(time) > new Date(devicesMap[devID].lastTime)) {
        devicesMap[devID].lastTime = time;
      }
    });

    return Object.values(devicesMap).sort((a, b) => a.devID.localeCompare(b.devID));
  }, [rawData]);

  useEffect(() => {
    if (!selectedDevID && devices.length > 0) {
      setSelectedDevID(devices[0].devID);
    }
  }, [devices, selectedDevID]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const selectedDeviceData = devices.find(d => d.devID === selectedDevID);

  const latestWeight1 = selectedDeviceData?.sensors?.weight1;
  const latestWeight2 = selectedDeviceData?.sensors?.weight2;

  const biomassOutput = useMemo(() => {
    if (latestWeight2 === undefined || latestWeight2 === null) return "0.00";
    return (parseFloat(latestWeight2) / 15).toFixed(2);
  }, [latestWeight2]);

  const getAlertClass = (type, value) => {
    const val = parseFloat(value);
    if (type === "Temperature" && val > 37) return "card-warning-alert";
    if (type === "Humidity" && val > 75) return "card-warning-alert";
    if (type === "CO2" && val > 5000) return "card-warning-alert";
    if (type === "NH3" && val > 1000) return "card-warning-alert";
    if (type === "ACMotor" && val > 1.5) return "card-warning-alert";
    if (type === "BatVoltage" && val < 1.5) return "card-warning-alert";
    return "";
  };

  return (
    <div className="content">
      {error && (
        <Alert color="danger" toggle={() => setError(null)}>
          {t(error)}
        </Alert>
      )}

      {/* 頂部控制欄 */}
      <Row>
        <Col xs="12">
          <Card>
            <CardHeader>
              <Row className="align-items-center">
                <Col md="6">
                  <CardTitle tag="h2">{t('monitorDashboard.title')}</CardTitle>
                  <p className="text-muted">
                    {t('monitorDashboard.lastUpdate')}: {lastUpdated === UNKNOWN_LAST_UPDATED ? t('common.unknown') : lastUpdated}
                  </p>
                </Col>
                <Col md="6" className="text-right">
                  <button className="btn btn-info btn-sm" onClick={fetchData} disabled={loading}>
                    {loading ? <Spinner size="sm" /> : t('common.refresh')}
                  </button>
                </Col>
              </Row>
            </CardHeader>
            <CardBody>
              <Row>
                <Col md="4">
                  <FormGroup>
                    <Label for="devSelect" className="text-dark">{t('monitorDashboard.selectDevice')}</Label>
                    <Input
                      type="select"
                      id="devSelect"
                      value={selectedDevID}
                      onChange={(e) => setSelectedDevID(e.target.value)}
                      className="bg-white text-dark border-info"
                    >
                      <option value="">{t('monitorDashboard.chooseDevice')}</option>
                      {devices.map(dev => (
                        <option key={dev.devID} value={dev.devID}>{dev.devID}</option>
                      ))}
                    </Input>
                  </FormGroup>
                  {selectedDeviceData && selectedDeviceData.sensors.GPS && (
                    <p className="mb-0 text-dark">
                      {t('monitorDashboard.gpsLocation')}: {selectedDeviceData.sensors.GPS}
                    </p>
                  )}
                </Col>
                {selectedDeviceData && (
                  <Col md="4" className="d-flex flex-column justify-content-center">
                    <p className="mb-0 text-muted">{t('monitorDashboard.lastSeen')}: {new Date(selectedDeviceData.lastTime).toLocaleString()}</p>
                  </Col>
                )}
                {selectedDeviceData && selectedDeviceData.sensors.GPS && (
                  <Col md="4">
                    <a
                      href={`https://www.google.com/maps?q=${encodeURIComponent(selectedDeviceData.sensors.GPS)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={t('monitorDashboard.viewOnGoogleMaps')}
                      className="d-block"
                      style={{ borderRadius: "1rem", overflow: "hidden", border: "1px solid rgba(88,147,173,0.25)" }}
                    >
                      <iframe
                        title="device-location-map"
                        width="100%"
                        height="160"
                        style={{ border: 0, display: "block", pointerEvents: "none" }}
                        loading="lazy"
                        src={`https://www.google.com/maps?q=${encodeURIComponent(selectedDeviceData.sensors.GPS)}&output=embed`}
                      />
                    </a>
                  </Col>
                )}
              </Row>
            </CardBody>
          </Card>
        </Col>
      </Row>

      {selectedDeviceData && (
        <>
          {/* 第一區 WASTE PROCESSED */}
          <h3 className="section-title">
            <i className="tim-icons icon-delivery-fast mr-2" /> {t('monitorDashboard.wasteProcessed')}
          </h3>
          <Row>
            <Col lg="4" md="6">
              <Card className="card-stats">
                <CardBody>
                  <Row>
                    <Col xs="5">
                      <div className="info-icon text-center icon-success">
                        <i className="tim-icons icon-delivery-fast" />
                      </div>
                    </Col>
                    <Col xs="7">
                      <div className="numbers">
                        <p className="card-category">{t('monitorDashboard.todaysInput')}</p>
                        <CardTitle tag="h3">
                          {latestWeight1 !== undefined && latestWeight1 !== null ? parseFloat(latestWeight1).toFixed(2) : "--"} <small>kg</small>
                        </CardTitle>
                      </div>
                    </Col>
                  </Row>
                </CardBody>
              </Card>
            </Col>
            <Col lg="4" md="6">
              <Card className="card-stats">
                <CardBody>
                  <Row>
                    <Col xs="5">
                      <div className="info-icon text-center icon-primary">
                        <i className="tim-icons icon-chart-pie-36" />
                      </div>
                    </Col>
                    <Col xs="7">
                      <div className="numbers">
                        <p className="card-category">{t('monitorDashboard.currentBiomass')}</p>
                        <CardTitle tag="h3">
                          {latestWeight2 !== undefined && latestWeight2 !== null ? parseFloat(latestWeight2).toFixed(2) : "--"} <small>kg</small>
                        </CardTitle>
                      </div>
                    </Col>
                  </Row>
                </CardBody>
              </Card>
            </Col>
            <Col lg="4" md="6">
              <Card className="card-stats">
                <CardBody>
                  <Row>
                    <Col xs="5">
                      <div className="info-icon text-center icon-warning">
                        <i className="tim-icons icon-coins" />
                      </div>
                    </Col>
                    <Col xs="7">
                      <div className="numbers">
                        <p className="card-category">{t('monitorDashboard.biomassOutput')}</p>
                        <CardTitle tag="h3">
                          {biomassOutput} <small>kg</small>
                        </CardTitle>
                      </div>
                    </Col>
                  </Row>
                </CardBody>
              </Card>
            </Col>
          </Row>

          {/* 第2區 ENVIRONMENTAL SENSORS */}
          <h3 className="section-title">
            <i className="tim-icons icon-world mr-2" /> {t('monitorDashboard.environmentalSensors')}
          </h3>
          <Row>
            {/* CHAMBER TEMP */}
            <Col lg="4" md="6">
              <Card className={`card-stats ${getAlertClass("Temperature", selectedDeviceData.sensors.Temperature)}`}>
                <CardBody>
                  <Row>
                    <Col xs="4">
                      <div className="info-icon text-center icon-info">
                        <i className="tim-icons icon-thermometer" />
                      </div>
                    </Col>
                    <Col xs="8">
                      <div className="numbers">
                        <p className="card-category">{t('monitorDashboard.chamberTemp')}</p>
                        <CardTitle tag="h3">
                          {selectedDeviceData.sensors.Temperature ?? "--"} <small>°C</small>
                        </CardTitle>
                      </div>
                    </Col>
                  </Row>
                </CardBody>
              </Card>
            </Col>
            {/* HUMIDITY */}
            <Col lg="4" md="6">
              <Card className={`card-stats ${getAlertClass("Humidity", selectedDeviceData.sensors.Humidity)}`}>
                <CardBody>
                  <Row>
                    <Col xs="4">
                      <div className="info-icon text-center icon-info">
                        <i className="tim-icons icon-drop-16" />
                      </div>
                    </Col>
                    <Col xs="8">
                      <div className="numbers">
                        <p className="card-category">{t('monitorDashboard.humidity')}</p>
                        <CardTitle tag="h3">
                          {selectedDeviceData.sensors.Humidity ?? "--"} <small>%</small>
                        </CardTitle>
                      </div>
                    </Col>
                  </Row>
                </CardBody>
              </Card>
            </Col>
            {/* CO2 & NH3 LEVEL */}
            <Col lg="4" md="6">
              {(() => {
                const co2Val = parseFloat(selectedDeviceData.sensors.CO2 ?? 0);
                const nh3Val = parseFloat(selectedDeviceData.sensors.NH3 ?? 0);
                const isAlert = co2Val > 5000 || nh3Val > 1000;
                return (
                  <Card className={`card-stats ${isAlert ? "card-warning-alert" : ""}`}>
                    <CardBody>
                      <Row>
                        <Col xs="4">
                          <div className="info-icon text-center icon-info">
                            <i className="tim-icons icon-molecule-40" />
                          </div>
                        </Col>
                        <Col xs="8">
                          <div className="numbers">
                            <p className="card-category">{t('monitorDashboard.co2Nh3Level')}</p>
                            <CardTitle tag="h3" style={{ fontSize: "1.2rem" }}>
                              {selectedDeviceData.sensors.CO2 ?? "--"} / {selectedDeviceData.sensors.NH3 ?? "--"} <small>ppm</small>
                            </CardTitle>
                          </div>
                        </Col>
                      </Row>
                    </CardBody>
                  </Card>
                );
              })()}
            </Col>
          </Row>

          {/* BIOMASS PERFORMANCE 幼蟲健康度 */}
          <h3 className="section-title">
            <i className="tim-icons icon-molecule-40 mr-2" /> {t('monitorDashboard.biomassPerformance')}
          </h3>
          <Row>
            <Col lg="6" md="8" xs="12">
              <Card>
                <CardHeader>
                  <CardTitle tag="h4">{t('monitorDashboard.larvalGrowthStage')}</CardTitle>
                </CardHeader>
                <CardBody>
                  <Table className="tablesorter">
                    <thead className="bg-white">
                      <tr>
                        <th>{t('monitorDashboard.chamberTemp')}</th>
                        <th>{t('monitorDashboard.humidity')}</th>
                        <th>{t('monitorDashboard.growthStatusColumn')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const temp = parseFloat(selectedDeviceData.sensors.Temperature);
                        const humidity = parseFloat(selectedDeviceData.sensors.Humidity);
                        const isActive = temp >= 15 && temp <= 45 && humidity >= 35 && humidity <= 75;
                        return (
                          <tr>
                            <td>{selectedDeviceData.sensors.Temperature ?? "--"} °C</td>
                            <td>{selectedDeviceData.sensors.Humidity ?? "--"} %</td>
                            <td>
                              <Badge color={isActive ? "success" : "dark"}>
                                {isActive ? t('monitorDashboard.statusActive') : t('monitorDashboard.statusInactive')}
                              </Badge>
                            </td>
                          </tr>
                        );
                      })()}
                    </tbody>
                  </Table>
                </CardBody>
              </Card>
            </Col>
          </Row>

          {/* SYSTEM STATUS 系統狀態 */}
          <h3 className="section-title">
            <i className="tim-icons icon-settings-gear-63 mr-2" /> {t('monitorDashboard.systemStatus')}
          </h3>
          <Row>
            <Col xs="12">
              <Card>
                <CardHeader>
                  <CardTitle tag="h4">{t('monitorDashboard.systemStatus')}</CardTitle>
                </CardHeader>
                <CardBody>
                  <div className="table-responsive" style={{ overflowX: 'auto', overflowY: 'visible' }}>
                    <Table className="tablesorter">
                      <thead className="bg-white">
                        <tr>
                          {["TiltDetect", "RollMotor", "CBoardPD", "FanMotorIN", "FanMotorOUT", "rssi", "value"].map(id => (
                            <th key={id}>{id}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          {["TiltDetect", "RollMotor", "CBoardPD", "FanMotorIN", "FanMotorOUT", "rssi", "value"].map(id => (
                            <td key={id}>{selectedDeviceData.sensors[id] ?? "--"}</td>
                          ))}
                        </tr>
                      </tbody>
                    </Table>
                  </div>
                </CardBody>
              </Card>
            </Col>
          </Row>

          {/* 第3區 ENERGY MONITORING */}
          <h3 className="section-title">
            <i className="tim-icons icon-bolt-31 mr-2" /> {t('monitorDashboard.energyMonitoring')}
          </h3>
          <Row>
            {/* SYSTEM USAGE */}
            <Col lg="6" md="6">
              <Card className={`card-stats ${getAlertClass("ACMotor", selectedDeviceData.sensors.ACMotor)}`}>
                <CardBody>
                  <Row>
                    <Col xs="4">
                      <div className="info-icon text-center icon-warning">
                        <i className="tim-icons icon-bolt-31" />
                      </div>
                    </Col>
                    <Col xs="8">
                      <div className="numbers">
                        <p className="card-category">{t('monitorDashboard.systemUsage')}</p>
                        <CardTitle tag="h3">
                          {selectedDeviceData.sensors.ACMotor ?? "--"} <small>kw</small>
                        </CardTitle>
                      </div>
                    </Col>
                  </Row>
                </CardBody>
              </Card>
            </Col>
            {/* SOLAR GENERATION */}
            <Col lg="6" md="6">
              <Card className={`card-stats ${getAlertClass("BatVoltage", selectedDeviceData.sensors.BatVoltage)}`}>
                <CardBody>
                  <Row>
                    <Col xs="4">
                      <div className="info-icon text-center icon-warning">
                        <i className="tim-icons icon-sound-wave" />
                      </div>
                    </Col>
                    <Col xs="8">
                      <div className="numbers">
                        <p className="card-category">{t('monitorDashboard.solarGeneration')}</p>
                        <CardTitle tag="h3">
                          {selectedDeviceData.sensors.BatVoltage ?? "--"} <small>kw</small>
                        </CardTitle>
                      </div>
                    </Col>
                  </Row>
                </CardBody>
              </Card>
            </Col>
          </Row>

          {/* 第4區 REDUCTION */}
          <h3 className="section-title">
            <i className="tim-icons icon-trash-simple mr-2" /> {t('monitorDashboard.reduction')}
          </h3>
          <Row>
            {/* LATEST REDUCTION */}
            <Col lg="6" md="6">
              <Card className="card-stats">
                <CardBody>
                  <Row>
                    <Col xs="4">
                      <div className="info-icon text-center icon-danger">
                        <i className="tim-icons icon-trash-simple" />
                      </div>
                    </Col>
                    <Col xs="8">
                      <div className="numbers">
                        <p className="card-category">{t('monitorDashboard.latestReduction')}</p>
                        <CardTitle tag="h3">
                          {(() => {
                            const w1 = parseFloat(latestWeight1 || 0);
                            const w2 = parseFloat(latestWeight2 || 0);
                            const biomassOut = w2 / 15;
                            const reduction = (w1 * 1.5) + (biomassOut * 0.9635);
                            return reduction.toFixed(2);
                          })()} <small>kg</small>
                        </CardTitle>
                      </div>
                    </Col>
                  </Row>
                </CardBody>
              </Card>
            </Col>
            {/* TOTAL REDUCTION */}
            <Col lg="6" md="6">
              <Card className="card-stats">
                <CardBody>
                  <Row>
                    <Col xs="4">
                      <div className="info-icon text-center icon-primary">
                        <i className="tim-icons icon-chart-bar-32" />
                      </div>
                    </Col>
                    <Col xs="8">
                      <div className="numbers">
                        <p className="card-category">{t('monitorDashboard.totalReduction7Days')}</p>
                        <CardTitle tag="h3">
                          {totalReduction7Days} <small>kg</small>
                        </CardTitle>
                      </div>
                    </Col>
                  </Row>
                </CardBody>
              </Card>
            </Col>
          </Row>
        </>
      )}

      {/* CONTAINER WEIGHT TREND 歷史趨勢圖表區 */}
      {selectedDeviceData && ('weight2' in selectedDeviceData.sensors) && (
        <Row>
          <Col xs="12">
            <Card className="card-chart">
              <CardHeader>
                <Row>
                  <Col className="text-left" sm="6">
                    <h5 className="card-category">{t('monitorDashboard.historyData')}</h5>
                    <CardTitle tag="h2">{t('monitorDashboard.weightTrend')}</CardTitle>
                  </Col>
                  <Col sm="6" className="text-right">
                    <div className="btn-group">
                      {["7", "15", "30"].map(d => (
                        <button
                          key={d}
                          className={`btn btn-sm ${weightTrendDays === d ? 'btn-info' : 'btn-secondary'}`}
                          onClick={() => setWeightTrendDays(d)}
                        >
                          {t(`monitorDashboard.days${d}`)}
                        </button>
                      ))}
                    </div>
                  </Col>
                </Row>
              </CardHeader>
              <CardBody>
                {loadingHistory ? (
                  <div className="text-center py-5"><Spinner color="info" /></div>
                ) : (
                  <div className="custom-chart-container">
                    <Line 
                      data={(canvas) => {
                        let ctx = canvas.getContext("2d");
                        let gradientStroke = ctx.createLinearGradient(0, 400, 0, 50);
                        gradientStroke.addColorStop(1, "rgba(192, 192, 192, 0.35)");
                        gradientStroke.addColorStop(0.4, "rgba(192, 192, 192, 0.05)");
                        gradientStroke.addColorStop(0, "rgba(192, 192, 192, 0)");

                        return {
                          labels: weightChartData.labels,
                          datasets: [{
                            ...weightChartData.datasets[0],
                            backgroundColor: gradientStroke,
                            borderColor: "#c0c0c0",
                            borderWidth: 2.5,
                            pointBackgroundColor: "#ffffff",
                            pointBorderColor: "#c0c0c0",
                            pointBorderWidth: 2,
                            pointHoverBackgroundColor: "#c0c0c0",
                            pointHoverBorderColor: "#ffffff",
                            pointHoverBorderWidth: 2,
                            pointRadius: 4,
                            pointHoverRadius: 7,
                          }]
                        };
                      }}
                      options={{
                        maintainAspectRatio: false,
                        layout: {
                          padding: { top: 16, right: 20, bottom: 8, left: 8 }
                        },
                        plugins: {
                          legend: { display: false },
                          tooltip: {
                            backgroundColor: "#1e1e1e",
                            titleColor: "#ffffff",
                            bodyColor: "#f5f5f5",
                            bodySpacing: 6,
                            padding: 14,
                            cornerRadius: 8,
                            borderColor: "rgba(192, 192, 192, 0.3)",
                            borderWidth: 1,
                            displayColors: false,
                            callbacks: {
                              label: ctx => `${ctx.parsed.y} kg`
                            }
                          }
                        },
                        scales: {
                          y: {
                            beginAtZero: true,
                            grid: {
                              color: "rgba(0, 0, 0, 0.06)",
                              borderDash: [4, 4]
                            },
                            border: { dash: [4, 4], color: "transparent" },
                            ticks: {
                              color: "#6c6c6c",
                              padding: 12,
                              callback: val => `${val} kg`
                            }
                          },
                          x: {
                            grid: { display: false },
                            border: { color: "rgba(0,0,0,0.08)" },
                            ticks: {
                              color: "#6c6c6c",
                              padding: 10,
                              maxRotation: 0,
                              callback: function(val) {
                                const label = this.getLabelForValue(val);
                                if (!label) return '';
                                const p = label.split('-');
                                return p.length === 3 ? `${p[1]}/${p[2]}` : label;
                              }
                            }
                          }
                        }
                      }}
                    />
                  </div>
                )}
              </CardBody>
            </Card>
          </Col>
        </Row>
      )}

      {/* DAILY REDUCTION 歷史趨勢圖表區 */}
      {selectedDeviceData && (
        <Row>
          <Col xs="12">
            <Card className="card-chart">
              <CardHeader>
                <Row>
                  <Col className="text-left" sm="6">
                    <h5 className="card-category">{t('monitorDashboard.reductionAnalysis')}</h5>
                    <CardTitle tag="h2">{t('monitorDashboard.dailyReductionTrend')}</CardTitle>
                  </Col>
                </Row>
              </CardHeader>
              <CardBody>
                {loadingHistory ? (
                  <div className="text-center py-5"><Spinner color="info" /></div>
                ) : (
                  <div className="custom-chart-container">
                    <Line 
                      data={(canvas) => {
                        let ctx = canvas.getContext("2d");
                        let gradientStroke = ctx.createLinearGradient(0, 400, 0, 50);
                        gradientStroke.addColorStop(1, "rgba(120, 120, 120, 0.35)");
                        gradientStroke.addColorStop(0.4, "rgba(120, 120, 120, 0.05)");
                        gradientStroke.addColorStop(0, "rgba(120, 120, 120, 0)");

                        return {
                          labels: reductionChartData.labels,
                          datasets: [{
                            ...reductionChartData.datasets[0],
                            backgroundColor: gradientStroke,
                            borderColor: "#787878",
                            borderWidth: 2.5,
                            pointBackgroundColor: "#ffffff",
                            pointBorderColor: "#787878",
                            pointBorderWidth: 2,
                            pointHoverBackgroundColor: "#787878",
                            pointHoverBorderColor: "#ffffff",
                            pointHoverBorderWidth: 2,
                            pointRadius: 4,
                            pointHoverRadius: 7,
                          }]
                        };
                      }}
                      options={{
                        maintainAspectRatio: false,
                        layout: {
                          padding: { top: 16, right: 20, bottom: 8, left: 8 }
                        },
                        plugins: {
                          legend: { display: false },
                          tooltip: {
                            backgroundColor: "#1e1e1e",
                            titleColor: "#ffffff",
                            bodyColor: "#f5f5f5",
                            bodySpacing: 6,
                            padding: 14,
                            cornerRadius: 8,
                            borderColor: "rgba(120, 120, 120, 0.3)",
                            borderWidth: 1,
                            displayColors: false,
                            callbacks: {
                              label: ctx => `${ctx.parsed.y} kg`
                            }
                          }
                        },
                        scales: {
                          y: {
                            beginAtZero: true,
                            grid: {
                              color: "rgba(0, 0, 0, 0.06)",
                              borderDash: [4, 4]
                            },
                            border: { dash: [4, 4], color: "transparent" },
                            ticks: {
                              color: "#6c6c6c",
                              padding: 12,
                              callback: val => `${val} kg`
                            }
                          },
                          x: {
                            grid: { display: false },
                            border: { color: "rgba(0,0,0,0.08)" },
                            ticks: {
                              color: "#6c6c6c",
                              padding: 10,
                              maxRotation: 0,
                              callback: function(val) {
                                const label = this.getLabelForValue(val);
                                if (!label) return '';
                                const p = label.split('-');
                                return p.length === 3 ? `${p[1]}/${p[2]}` : label;
                              }
                            }
                          }
                        }
                      }}
                    />
                  </div>
                )}
              </CardBody>
            </Card>
          </Col>
        </Row>
      )}

      {/* 底部摘要表格 */}
      <Row>
        <Col xs="12">
          <Card>
            <CardHeader>
              <CardTitle tag="h4">{t('monitorDashboard.devicesOverview')}</CardTitle>
            </CardHeader>
            <CardBody>
              <Table className="tablesorter" responsive>
                <thead className="bg-white">
                  <tr>
                    <th>{t('monitorDashboard.devIdColumn')}</th>
                    <th>{t('monitorDashboard.statusColumn')}</th>
                    <th>{t('monitorDashboard.latestValuesColumn')}</th>
                    <th>{t('monitorDashboard.lastSeenColumn')}</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && devices.length === 0 ? (
                    <tr><td colSpan="4" className="text-center"><Spinner color="primary" /></td></tr>
                  ) : (
                    devices.map((dev, index) => (
                      <tr 
                        key={index} 
                        style={{ cursor: 'pointer' }} 
                        onClick={() => setSelectedDevID(dev.devID)}
                        className={selectedDevID === dev.devID ? "table-info" : ""}
                      >
                        <td><span className="text-dark font-weight-bold">{dev.devID}</span></td>
                        <td>
                          <Badge color="success">{t('common.online')}</Badge>
                        </td>
                        <td>
                          {Object.entries(dev.sensors).slice(0, 3).map(([type, val], i) => (
                            <Badge color="dark" key={i} className="mr-1">{type}: {val}</Badge>
                          ))}
                          {Object.keys(dev.sensors).length > 3 && <span className="text-muted">...</span>}
                        </td>
                        <td>{new Date(dev.lastTime).toLocaleString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </Table>
            </CardBody>
          </Card>
        </Col>
      </Row>
    </div>
  );
}

export default MonitorDashboard;
