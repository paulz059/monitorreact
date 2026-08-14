import unittest
from decimal import Decimal

from value_parsing import parse_sensor_value


class TestParseSensorValue(unittest.TestCase):
    def test_numeric_string_becomes_decimal(self):
        result = parse_sensor_value("23.5")
        self.assertEqual(result, Decimal("23.5"))

    def test_integer_string_becomes_decimal(self):
        result = parse_sensor_value("42")
        self.assertEqual(result, Decimal("42"))

    def test_gps_coordinate_string_is_kept_as_is(self):
        result = parse_sensor_value("22.37065,114.11797")
        self.assertEqual(result, "22.37065,114.11797")

    def test_none_returns_none(self):
        self.assertIsNone(parse_sensor_value(None))


if __name__ == "__main__":
    unittest.main()
