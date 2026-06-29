"""
app.py - Flask Web Application for Product Analytics Dashboard
Serves a beautiful web dashboard and handles report export.
"""

import os
from flask import Flask, render_template, send_file, jsonify
from analytics import generate_full_analysis, export_report

# --- Configuration ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CSV_PATH = os.path.join(BASE_DIR, "data", "products.csv")
REPORTS_DIR = os.path.join(BASE_DIR, "reports")
REPORT_FILE = os.path.join(REPORTS_DIR, "product_report.txt")

app = Flask(__name__)


@app.route("/")
def dashboard():
    """Render the main analytics dashboard."""
    analysis = generate_full_analysis(CSV_PATH)
    return render_template("index.html", data=analysis)


@app.route("/api/analytics")
def api_analytics():
    """Return analytics data as JSON (for AJAX / future use)."""
    analysis = generate_full_analysis(CSV_PATH)
    return jsonify(analysis)


@app.route("/export")
def export():
    """Generate and download the analytics report as a text file."""
    analysis = generate_full_analysis(CSV_PATH)
    export_report(analysis, REPORT_FILE)
    return send_file(
        REPORT_FILE,
        as_attachment=True,
        download_name="product_analytics_report.txt",
        mimetype="text/plain",
    )


if __name__ == "__main__":
    os.makedirs(REPORTS_DIR, exist_ok=True)
    print("\n  [*] Product Analytics Dashboard")
    print("  --> http://127.0.0.1:5000\n")
    app.run(debug=True, port=5000)
