"""Feature preparation and inference helpers for the tattoo price model."""

from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd

RATE_TARGETS = {
    "min": "min_price_inr",
    "mid": "accurate_price_inr",
    "max": "max_price_inr",
}
TARGET_ENCODED_FEATURES = ["location_key", "state_ut", "city_group"]
ONE_HOT_FEATURES = ["location_type", "complexity", "color"]
NUMERIC_FEATURES = ["log_area"]
UNKNOWN = "__unknown__"
TRAINED_MAX_AREA_SQ_IN = 25
MAX_SIDE_IN = 34
SIZE_STEP_IN = 0.5
COMPLEXITY_MIN_SIDE_IN = {"Simple": 1, "Medium": 2, "Complex": 3}

_PLACEMENT_LIMITS = [
    (("finger", "knuckle", "toe"), 2.5, 1, 3),
    (("behind",), 3, 2, 3),
    (("wrist",), 4, 3, 3),
    (("ankle",), 4, 3, 3),
    (("palm", "hand"), 5, 4, 3),
    (("foot", "heel"), 6, 4, 3),
    (("neck",), 5, 4, 3),
    (("knee",), 6, 6, 3),
    (("band",), 14, 3.5, 4),
    (("spine",), 16, 4, 4),
    (("full sleeve",), 26, 12, 3),
    (("half sleeve",), 14, 12, 3),
    (("full leg",), 34, 14, 3),
    (("half leg",), 16, 12, 3),
    (("forearm",), 10, 5, 3),
    (("upper arm", "bicep", "shoulder blade"), 8, 7, 3),
    (("shoulder",), 8, 7, 3),
    (("calf", "shin"), 12, 6, 3),
    (("thigh",), 14, 9, 3),
    (("full back",), 20, 18, 3),
    (("upper back",), 14, 8, 3),
    (("lower back",), 12, 6, 3),
    (("side of back", "back"), 14, 10, 3),
    (("sternum",), 8, 6, 3),
    (("rib", "side of torso"), 12, 8, 3),
    (("abdomen",), 10, 8, 3),
    (("chest", "torso"), 10, 8, 3),
]


def location_key(name: Any, location_type: Any, state: Any) -> str:
    return "|".join(str(value).strip() for value in (name, location_type, state))


def build_features(rows: pd.DataFrame) -> pd.DataFrame:
    """Build the exact feature columns used to fit the saved rate models."""
    city_group = rows["parent_city"].where(rows["parent_city"].notna(), rows["location_name"])
    city_group = city_group.fillna(UNKNOWN).astype(str).str.strip().replace("", UNKNOWN)
    area = pd.to_numeric(rows["area_sq_in"], errors="raise")
    return pd.DataFrame(
        {
            "location_key": rows["location_key"].fillna(UNKNOWN).astype(str),
            "state_ut": rows["state_ut"].fillna(UNKNOWN).astype(str),
            "city_group": city_group,
            "location_type": rows["location_type"].fillna("City/Town").astype(str),
            "complexity": rows["complexity"].astype(str),
            "color": rows["color"].astype(str),
            "log_area": np.log(area),
        },
        index=rows.index,
    )


def round_price(value: float) -> int:
    return int(round(float(value) / 50) * 50)


def validate_dimensions(width: float, height: float, complexity: str, placement: str | None = None) -> list[str]:
    errors: list[str] = []
    for label, value in (("Width", width), ("Height", height)):
        if not np.isfinite(value) or value <= 0:
            errors.append(f"{label} must be a positive number of inches.")
        elif abs(value / SIZE_STEP_IN - round(value / SIZE_STEP_IN)) > 1e-6:
            errors.append(f"{label} must be in {SIZE_STEP_IN:g} inch steps.")
    if errors:
        return errors

    long_side = max(width, height)
    short_side = min(width, height)
    min_side = COMPLEXITY_MIN_SIDE_IN[complexity]
    long_max = short_max = MAX_SIDE_IN
    max_ratio = 3
    name = (placement or "").strip().lower()
    for keywords, placement_long_max, placement_short_max, placement_ratio in _PLACEMENT_LIMITS:
        if any(keyword in name for keyword in keywords):
            long_max, short_max, max_ratio = placement_long_max, placement_short_max, placement_ratio
            break

    if short_side < min_side:
        errors.append(f"{complexity} designs need at least {min_side} x {min_side} in to stay readable.")
    if long_side / short_side > max_ratio + 1e-9:
        errors.append(
            f"Proportion {long_side:g}:{short_side:g} is too stretched; keep the long side within {max_ratio}x the short side."
        )
    if long_side > long_max or short_side > short_max:
        where = f" on {placement.strip()}" if placement and placement.strip() else ""
        errors.append(
            f"{long_side:g} x {short_side:g} in is too large{where}; "
            f"the maximum is {long_max:g} x {short_max:g} in."
        )
    return errors


class TattooPricer:
    def __init__(self, bundle: dict[str, Any]):
        if bundle.get("version") != 2:
            raise ValueError("Unsupported tattoo price model bundle version.")
        self.models = bundle["models"]
        if set(self.models) != {"min", "mid", "max"}:
            raise ValueError("Price model bundle must include min, mid, and max rate models.")
        self.locations = pd.DataFrame(bundle["locations"])
        self.images = pd.DataFrame(bundle["images"]).set_index("image_name")
        if self.locations.empty or self.images.empty:
            raise ValueError("Price model bundle does not contain location and image data.")
        self._state_minimums = self.locations.groupby("state_ut")["minimum_studio_charge_inr"].median()
        self._default_minimum = float(self.locations["minimum_studio_charge_inr"].median())

    def resolve_location(
        self,
        city: str,
        state: str | None = None,
        location_type: str | None = None,
    ) -> dict[str, Any]:
        requested_name = city.strip()
        matches = self.locations[
            self.locations["location_name"].astype(str).str.casefold() == requested_name.casefold()
        ]
        if state:
            state_matches = matches[
                matches["state_ut"].astype(str).str.casefold() == state.strip().casefold()
            ]
            if not state_matches.empty:
                matches = state_matches
        if location_type:
            type_matches = matches[
                matches["location_type"].astype(str).str.casefold() == location_type.strip().casefold()
            ]
            if not type_matches.empty:
                matches = type_matches

        if not matches.empty:
            preferred = matches[matches["location_type"] == "City/Town"]
            selected = (preferred if not preferred.empty else matches).iloc[0].to_dict()
            selected["known"] = True
            return selected

        resolved_state = state.strip() if state and state.strip() else UNKNOWN
        minimum_charge = float(self._state_minimums.get(resolved_state, self._default_minimum))
        return {
            "location_key": UNKNOWN,
            "location_name": requested_name,
            "location_type": location_type or "City/Town",
            "state_ut": resolved_state,
            "parent_city": None,
            "per_sq_in_rate_min_inr": None,
            "per_sq_in_rate_max_inr": None,
            "minimum_studio_charge_inr": minimum_charge,
            "known": False,
        }

    def predict(
        self,
        location: dict[str, Any],
        width: float,
        height: float,
        complexity: str,
        color: str,
    ) -> dict[str, float | bool]:
        area = width * height
        row = pd.DataFrame(
            [
                {
                    "location_key": location["location_key"],
                    "location_name": location["location_name"],
                    "location_type": location["location_type"],
                    "state_ut": location["state_ut"],
                    "parent_city": location.get("parent_city"),
                    "complexity": complexity,
                    "color": color,
                    "area_sq_in": area,
                }
            ]
        )
        features = build_features(row)
        predicted_rates = np.array(
            [np.exp(float(self.models[name].predict(features)[0])) for name in ("min", "mid", "max")]
        )
        predicted_rates.sort()
        minimum_charge = float(location["minimum_studio_charge_inr"])
        prices = [
            round_price(max(rate * area, minimum_charge))
            for rate in predicted_rates
        ]
        return {
            "price_min": prices[0],
            "price_mid": prices[1],
            "price_max": prices[2],
            "area_sq_in": area,
            "minimum_charge": minimum_charge,
            "extrapolated": area > TRAINED_MAX_AREA_SQ_IN,
        }
