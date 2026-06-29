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
import React from 'react';
import MonitorDashboard from "views/MonitorDashboard.js";
import RawData from "views/RawData.js";

var routes = [
  {
    path: "/monitor",
    name: "Monitor Dashboard",
    icon: "tim-icons icon-chart-pie-36",
    component: <MonitorDashboard />,
    layout: "/admin",
  },
  {
    path: "/raw-data",
    name: "RAW 資料",
    icon: "tim-icons icon-paper",
    component: <RawData />,
    layout: "/admin",
  }
];
export default routes;
