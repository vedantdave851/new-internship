"""
analytics.py - Core Product Analytics Engine
Handles CSV reading, data analysis, and report generation.
"""

import csv
import os
from datetime import datetime
from typing import Any


def read_csv_data(filepath: str) -> list[dict[str, Any]]:
    """Read product sales data from a CSV file and return structured records."""
    products = []
    with open(filepath, mode="r", encoding="utf-8") as csvfile:
        reader = csv.DictReader(csvfile)
        for row in reader:
            products.append({
                "product": row["Product"].strip(),
                "quantity": int(row["Quantity"]),
                "price": float(row["Price"]),
                "revenue": int(row["Quantity"]) * float(row["Price"]),
            })
    return products


def get_total_revenue(products: list[dict[str, Any]]) -> float:
    """Calculate total revenue across all products."""
    return sum(p["revenue"] for p in products)


def get_top_selling(products: list[dict[str, Any]], n: int = 5) -> list[dict[str, Any]]:
    """Return the top N selling products sorted by quantity (descending)."""
    sorted_products = sorted(products, key=lambda p: p["quantity"], reverse=True)
    return sorted_products[:n]


def get_least_selling(products: list[dict[str, Any]], n: int = 5) -> list[dict[str, Any]]:
    """Return the bottom N selling products sorted by quantity (ascending)."""
    sorted_products = sorted(products, key=lambda p: p["quantity"])
    return sorted_products[:n]


def get_highest_revenue(products: list[dict[str, Any]], n: int = 5) -> list[dict[str, Any]]:
    """Return the top N products by revenue (descending)."""
    sorted_products = sorted(products, key=lambda p: p["revenue"], reverse=True)
    return sorted_products[:n]


def get_summary_stats(products: list[dict[str, Any]]) -> dict[str, Any]:
    """Generate summary statistics for the product data."""
    total_revenue = get_total_revenue(products)
    total_quantity = sum(p["quantity"] for p in products)
    avg_price = sum(p["price"] for p in products) / len(products) if products else 0

    return {
        "total_products": len(products),
        "total_revenue": total_revenue,
        "total_quantity": total_quantity,
        "average_price": round(avg_price, 2),
    }


def generate_full_analysis(filepath: str) -> dict[str, Any]:
    """Run the complete analytics pipeline and return all results."""
    products = read_csv_data(filepath)
    summary = get_summary_stats(products)
    top_selling = get_top_selling(products)
    least_selling = get_least_selling(products)
    highest_revenue = get_highest_revenue(products)

    return {
        "products": products,
        "summary": summary,
        "top_selling": top_selling,
        "least_selling": least_selling,
        "highest_revenue": highest_revenue,
        "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
    }


def export_report(analysis: dict[str, Any], output_path: str) -> str:
    """Export the analytics report as a formatted text file."""
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    lines = []
    lines.append("=" * 60)
    lines.append("       PRODUCT ANALYTICS REPORT")
    lines.append("=" * 60)
    lines.append(f"  Generated: {analysis['generated_at']}")
    lines.append("=" * 60)
    lines.append("")

    # --- Summary ---
    s = analysis["summary"]
    lines.append("-" * 60)
    lines.append("  SUMMARY")
    lines.append("-" * 60)
    lines.append(f"  Total Products   : {s['total_products']}")
    lines.append(f"  Total Revenue    : Rs. {s['total_revenue']:,.2f}")
    lines.append(f"  Total Quantity   : {s['total_quantity']}")
    lines.append(f"  Average Price    : Rs. {s['average_price']:,.2f}")
    lines.append("")

    # --- Top Selling ---
    lines.append("-" * 60)
    lines.append("  TOP 5 SELLING PRODUCTS (by Quantity)")
    lines.append("-" * 60)
    lines.append(f"  {'Rank':<6}{'Product':<15}{'Qty':<10}{'Price':<12}{'Revenue':<15}")
    lines.append(f"  {'----':<6}{'-------':<15}{'---':<10}{'-----':<12}{'-------':<15}")
    for i, p in enumerate(analysis["top_selling"], 1):
        lines.append(
            f"  {i:<6}{p['product']:<15}{p['quantity']:<10}"
            f"Rs.{p['price']:>8,.0f}   Rs.{p['revenue']:>10,.0f}"
        )
    lines.append("")

    # --- Least Selling ---
    lines.append("-" * 60)
    lines.append("  LEAST SELLING PRODUCTS (by Quantity)")
    lines.append("-" * 60)
    lines.append(f"  {'Rank':<6}{'Product':<15}{'Qty':<10}{'Price':<12}{'Revenue':<15}")
    lines.append(f"  {'----':<6}{'-------':<15}{'---':<10}{'-----':<12}{'-------':<15}")
    for i, p in enumerate(analysis["least_selling"], 1):
        lines.append(
            f"  {i:<6}{p['product']:<15}{p['quantity']:<10}"
            f"Rs.{p['price']:>8,.0f}   Rs.{p['revenue']:>10,.0f}"
        )
    lines.append("")

    # --- Highest Revenue ---
    lines.append("-" * 60)
    lines.append("  HIGHEST REVENUE PRODUCTS")
    lines.append("-" * 60)
    lines.append(f"  {'Rank':<6}{'Product':<15}{'Qty':<10}{'Price':<12}{'Revenue':<15}")
    lines.append(f"  {'----':<6}{'-------':<15}{'---':<10}{'-----':<12}{'-------':<15}")
    for i, p in enumerate(analysis["highest_revenue"], 1):
        lines.append(
            f"  {i:<6}{p['product']:<15}{p['quantity']:<10}"
            f"Rs.{p['price']:>8,.0f}   Rs.{p['revenue']:>10,.0f}"
        )
    lines.append("")
    lines.append("=" * 60)
    lines.append("  END OF REPORT")
    lines.append("=" * 60)

    report_text = "\n".join(lines)
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(report_text)

    return report_text
