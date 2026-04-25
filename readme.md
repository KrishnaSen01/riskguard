# 🚨 Hybrid Real-Time Fraud Detection System

A scalable **real-time fraud detection platform** that combines:

✅ Rule-Based Risk Engine  
✅ XGBoost Machine Learning Model  
✅ Hybrid Scoring Logic  
✅ Live Alerts Dashboard  
✅ Real-Time Socket.IO Updates  

Designed for fintech, banking, UPI, payment gateways, and transaction monitoring systems.

---

# 📌 Project Overview

Traditional fraud systems rely only on static rules or only ML.

Our project uses a **Hybrid Architecture**:

- Rule Engine gives instant explainable scores
- XGBoost detects hidden fraud patterns
- Hybrid logic combines both intelligently
- React dashboard shows alerts in real-time

---

# 🏗️ System Architecture

## 🔹 Frontend

- React.js Dashboard
- Socket.IO Client
- Live Risk Gauge
- Charts & Metrics
- Fraud Alerts Panel

## 🔹 Backend (Node.js)

- Express.js APIs
- Rule Engine
- Hybrid Score Engine
- Alert Generator
- Socket.IO Server

## 🔹 ML Microservice

- Flask API
- XGBoost Fraud Prediction Model

## 🔹 Storage

- In-memory / MongoDB Ready
- Transactions
- Alerts
- User Profiles

---

# 🔄 End-to-End Workflow

```text
Transaction Input
     ↓
Validation
     ↓
Rule Engine Score
     ↓
Send Features to XGBoost Model
     ↓
ML Prediction Score
     ↓
Hybrid Score Calculation
     ↓
If Risk > Threshold → Alert
     ↓
Store Transaction
     ↓
Send Live Update via Socket.IO
     ↓
React Dashboard Updates