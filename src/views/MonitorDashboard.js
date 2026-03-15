/*!

=========================================================
* Black Dashboard React v1.2.2
=========================================================

* Product Page: https://www.creative-tim.com/product/black-dashboard-react
* Copyright 2023 Creative Tim (https://www.creative-tim.com)
* Licensed under MIT (https://github.com/creativetimofficial/black-dashboard-react/blob/master/LICENSE.md)

* Coded by Creative Tim

=========================================================

* The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

*/
import React, { useState } from "react";
import { Line } from "react-chartjs-2";
import {
  Card,
  CardHeader,
  CardBody,
  CardTitle,
  Row,
  Col,
  FormGroup,
  Label,
  Input,
} from "reactstrap";

import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);




// Dummy data for charts
const dummyChartData = {
  A: { data1: [10, 20, 30, 25, 40, 35, 50] },
  B: { data1: [15, 25, 35, 30, 45, 40, 55] },
  C: { data1: [20, 30, 40, 35, 50, 45, 60] },
  D: { data1: [25, 35, 45, 40, 55, 50, 65] },
};

const chartOptions = {
 
    options: {
    maintainAspectRatio: false, // 讓圖表完整填滿外層高度
    responsive: true,           // 讓圖表隨螢幕縮放
    plugins: {
      legend: {
        display: false,         // 隱藏圖例
      },
      tooltip: {
        enabled: false,         // 隱藏提示框
      },
    },
    scales: {
      y: {  // 注意：新版已經沒有 yAxes 陣列了，改成 y 物件
        ticks: {
          color: "#9f9f9f",     // 注意：新版 fontColor 改為 color
          maxTicksLimit: 5,
        },
        grid: {                 // 注意：新版 gridLines 改為 grid
          drawBorder: false,
          color: "rgba(255,255,255,0.05)",
        },
      },
      x: {  // 注意：新版沒有 xAxes 陣列，改成 x 物件
        ticks: {
          padding: 10,          // 減少 padding，避免文字被往下推到看不見
          color: "#9f9f9f",
    },
        grid: {
          drawBorder: false,
          color: "rgba(255,255,255,0.1)",
        },
      },
    },
  }


};



const chartHeight = 300; // 設定圖表高度
function MonitorDashboard() {
  const [locations, setLocations] = useState(["A", "B", "C", "D"]);

  const handleLocationChange = (e) => {
    const value = e.target.value;
    if (locations.includes(value)) {
      setLocations(locations.filter((loc) => loc !== value));
    } else {
      setLocations([...locations, value]);
    }
  };

  return (
    <>
      <div className="content">
        <Row>
          <Col xs="12">
            <Card>
              <CardHeader>
                <CardTitle>Monitor Dashboard</CardTitle>
              </CardHeader>
              <CardBody>
                <FormGroup>
                  <Label>Select Locations:</Label>
                  <div>
                    <Label check>
                      <Input
                        type="checkbox"
                        value="A"
                        checked={locations.includes("A")}
                        onChange={handleLocationChange}
                      />{" "}
                      Location A
                    </Label>
                    <Label check>
                      <Input
                        type="checkbox"
                        value="B"
                        checked={locations.includes("B")}
                        onChange={handleLocationChange}
                      />{" "}
                      Location B
                    </Label>
                    <Label check>
                      <Input
                        type="checkbox"
                        value="C"
                        checked={locations.includes("C")}
                        onChange={handleLocationChange}
                      />{" "}
                      Location C
                    </Label>
                    <Label check>
                      <Input
                        type="checkbox"
                        value="D"
                        checked={locations.includes("D")}
                        onChange={handleLocationChange}
                      />{" "}
                      Location D
                    </Label>
                  </div>
                </FormGroup>
              </CardBody>
            </Card>
          </Col>
        </Row>
        <Row>
          <Col xs="12">
            <Card className="card-chart">
              <CardHeader>
                <CardTitle tag="h3">Temperature Monitoring</CardTitle>
              </CardHeader>
              <CardBody>
                <div className="chart-area" style={{ height: chartHeight }}>
                  <Line
                    data={{
                      labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
                      datasets: locations.map((location) => ({
                        label: `Location ${location}`,
                        data: dummyChartData[location].data1,
                        borderColor: `#e3e3e3`,
                        backgroundColor: "transparent",
                        pointBorderColor: "black",
                        pointRadius: 5
                      })),
                    }}
                    options={chartOptions.options}
                  />
                </div>
              </CardBody>
            </Card>
          </Col>
          <Col xs="12">
            <Card className="card-chart">
              <CardHeader>
                <CardTitle tag="h3">Humidity Monitoring</CardTitle>
              </CardHeader>
              <CardBody>
                <div className="chart-area" style={{ height: chartHeight }}>
                  <Line
                    data={{
                      labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
                      datasets: locations.map((location) => ({
                        label: `Location ${location}`,
                        data: dummyChartData[location].data1,
                        borderColor: `#e3e3e3`,
                        backgroundColor: "transparent",
                        pointBorderColor: "black",
                        pointRadius: 5
                      })),
                    }}
                    options={chartOptions.options}
                  />
                </div>
              </CardBody>
            </Card>
          </Col>
        </Row>
        <Row>
          <Col xs="12">
            <Card className="card-chart">
              <CardHeader>
                <CardTitle tag="h3">Weight Monitoring</CardTitle>
              </CardHeader>
              <CardBody>
                <div className="chart-area" style={{ height: chartHeight }}>
                  <Line
                    data={{
                      labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
                      datasets: locations.map((location) => ({
                        label: `Location ${location}`,
                        data: dummyChartData[location].data1,
                        borderColor: `#e3e3e3`,
                        backgroundColor: "transparent",
                        pointBorderColor: "black",
                        pointRadius: 5
                      })),
                    }}
                    options={chartOptions.options}
                  />
                </div>
              </CardBody>
            </Card>
          </Col>
          <Col xs="12">
            <Card className="card-chart">
              <CardHeader>
                <CardTitle tag="h3">Outdoor Temperature Monitoring</CardTitle>
              </CardHeader>
              <CardBody>
                <div className="chart-area" style={{ height: chartHeight }}>
                  <Line
                    data={{
                      labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
                      datasets: locations.map((location) => ({
                        label: `Location ${location}`,
                        data: dummyChartData[location].data1,
                        borderColor: `#e3e3e3`,
                        backgroundColor: "transparent",
                        pointBorderColor: "black",
                        pointRadius: 5
                      })),
                    }}
                    options={chartOptions.options}
                  />
                </div>
              </CardBody>
            </Card>
          </Col>
        </Row>
      </div>
    </>
  );
}

export default MonitorDashboard;