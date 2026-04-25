"""
ML Microservice — PaySim XGBoost Fraud Detector
Exposes POST /predict  →  { fraud, probability, confidence }
Run: python ml_service.py
"""

import os
import pickle
import numpy as np
from flask import Flask, request, jsonify
from flask_cors import CORS

MODEL_PATH = os.path.join(os.path.dirname(__file__), "model", "paysim_xgboost_model.pkl")
ENCODER_PATH = os.path.join(os.path.dirname(__file__), "model", "label_encoder.pkl")

app = Flask(__name__)
CORS(app)

# ── Load model & encoder once at startup ─────────────────────────────────────
try:
    with open(MODEL_PATH, "rb") as f:
        model = pickle.load(f)
    print(f"[ML] OK: XGBoost model loaded from {MODEL_PATH}")
except Exception as e:
    model = None
    print(f"[ML] Error: Failed to load model: {e}")

try:
    with open(ENCODER_PATH, "rb") as f:
        label_encoder = pickle.load(f)
    print(f"[ML] OK: Label encoder loaded from {ENCODER_PATH}")
except Exception as e:
    label_encoder = None
    print(f"[ML] Error: Failed to load label encoder: {e}")

# PaySim transaction types
TRANSACTION_TYPES = ["CASH_IN", "CASH_OUT", "DEBIT", "PAYMENT", "TRANSFER"]


def encode_type(txn_type: str) -> int:
    """Encode transaction type string to integer."""
    if label_encoder is not None:
        try:
            return int(label_encoder.transform([txn_type])[0])
        except Exception:
            pass
    # Fallback manual mapping
    mapping = {"CASH_IN": 0, "CASH_OUT": 1, "DEBIT": 2, "PAYMENT": 3, "TRANSFER": 4}
    return mapping.get(txn_type.upper(), 3)


@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "model_loaded": model is not None,
        "encoder_loaded": label_encoder is not None,
    })


@app.route("/predict", methods=["POST"])
def predict():
    if model is None:
        return jsonify({"error": "Model not loaded"}), 503

    data = request.get_json(force=True)

    # Extract PaySim features with sensible defaults
    try:
        step            = int(data.get("step", 1))
        txn_type        = str(data.get("type", "PAYMENT"))
        amount          = float(data.get("amount", 0))
        old_balance_org = float(data.get("oldbalanceOrg", 0))
        new_balance_org = float(data.get("newbalanceOrig", max(0, old_balance_org - amount)))
        old_balance_dest = float(data.get("oldbalanceDest", 0))
        new_balance_dest = float(data.get("newbalanceDest", old_balance_dest + amount))
        is_flagged      = int(data.get("isFlaggedFraud", 0))

        type_encoded = encode_type(txn_type)

        # Feature vector (same order as training)
        features = np.array([[
            step,
            type_encoded,
            amount,
            old_balance_org,
            new_balance_org,
            old_balance_dest,
            new_balance_dest,
            is_flagged,
        ]], dtype=np.float64)

        prob = float(model.predict_proba(features)[0][1])
        fraud = bool(prob >= 0.5)

        if prob >= 0.75:
            confidence = "HIGH"
        elif prob >= 0.45:
            confidence = "MEDIUM"
        else:
            confidence = "LOW"

        return jsonify({
            "fraud":       fraud,
            "probability": round(prob, 4),
            "confidence":  confidence,
            "ml_score":    round(prob * 100, 1),
        })

    except Exception as e:
        print(f"[ML] Prediction error: {e}")
        return jsonify({"error": str(e)}), 400


@app.route("/feature-importance", methods=["GET"])
def feature_importance():
    """Return feature importance from the XGBoost model."""
    if model is None:
        return jsonify({"error": "Model not loaded"}), 503
    try:
        importance = model.feature_importances_.tolist()
        features = [
            "step", "type", "amount",
            "oldbalanceOrg", "newbalanceOrig",
            "oldbalanceDest", "newbalanceDest",
            "isFlaggedFraud"
        ]
        return jsonify({
            "features": features,
            "importance": importance,
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    port = int(os.environ.get("ML_PORT", 5001))
    print(f"\n[ML] Fraud Detection Service running on port {port}")
    print(f"   Health: http://localhost:{port}/health")
    print(f"   Predict: POST http://localhost:{port}/predict\n")
    app.run(host="0.0.0.0", port=port, debug=False)
