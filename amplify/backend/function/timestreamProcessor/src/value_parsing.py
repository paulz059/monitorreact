import math
from decimal import Decimal


def float_to_decimal(value):
    """Converts numeric values to Decimal for DynamoDB storage."""
    if value is None:
        return None
    try:
        # Convert through string to avoid float precision issues
        return Decimal(str(value))
    except:
        return value


def parse_sensor_value(val_str):
    """Converts a raw Timestream varchar value into the type used for
    DynamoDB storage. Numeric values become Decimal; non-numeric values
    (e.g. GPS "lat,lng" strings) and non-finite values (NaN/Infinity,
    which DynamoDB cannot store as numbers) are kept as-is.
    """
    if val_str is None:
        return None
    try:
        parsed = float(val_str)
    except (TypeError, ValueError):
        return val_str
    if not math.isfinite(parsed):
        return val_str
    return float_to_decimal(parsed)
