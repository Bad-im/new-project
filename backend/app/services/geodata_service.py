from app.schemas.prediction import GeoJSONFeatureCollection


def get_demo_hazard_geojson() -> GeoJSONFeatureCollection:
    return GeoJSONFeatureCollection(
        type="FeatureCollection",
        features=[
            {
                "type": "Feature",
                "properties": {
                    "hazard_class": 1,
                    "hazard_name": "Низкая",
                    "district": "Баргузинский район",
                    "area_ha": 1840.5,
                    "image_date": "2026-04-18",
                },
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [
                        [
                            [108.55, 51.78],
                            [108.82, 51.78],
                            [108.82, 51.96],
                            [108.55, 51.96],
                            [108.55, 51.78],
                        ]
                    ],
                },
            },
            {
                "type": "Feature",
                "properties": {
                    "hazard_class": 2,
                    "hazard_name": "Умеренная",
                    "district": "Кабанский район",
                    "area_ha": 2365.0,
                    "image_date": "2026-04-18",
                },
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [
                        [
                            [108.86, 51.82],
                            [109.15, 51.82],
                            [109.15, 52.02],
                            [108.86, 52.02],
                            [108.86, 51.82],
                        ]
                    ],
                },
            },
            {
                "type": "Feature",
                "properties": {
                    "hazard_class": 3,
                    "hazard_name": "Средняя",
                    "district": "Иволгинский район",
                    "area_ha": 1988.7,
                    "image_date": "2026-04-19",
                },
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [
                        [
                            [109.18, 51.74],
                            [109.48, 51.74],
                            [109.48, 51.94],
                            [109.18, 51.94],
                            [109.18, 51.74],
                        ]
                    ],
                },
            },
            {
                "type": "Feature",
                "properties": {
                    "hazard_class": 4,
                    "hazard_name": "Высокая",
                    "district": "Заиграевский район",
                    "area_ha": 2514.2,
                    "image_date": "2026-04-19",
                },
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [
                        [
                            [109.52, 51.9],
                            [109.82, 51.9],
                            [109.82, 52.12],
                            [109.52, 52.12],
                            [109.52, 51.9],
                        ]
                    ],
                },
            },
            {
                "type": "Feature",
                "properties": {
                    "hazard_class": 5,
                    "hazard_name": "Чрезвычайная",
                    "district": "Баргузинский район",
                    "area_ha": 1296.4,
                    "image_date": "2026-04-20",
                },
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [
                        [
                            [109.05, 52.0],
                            [109.36, 52.0],
                            [109.36, 52.18],
                            [109.05, 52.18],
                            [109.05, 52.0],
                        ]
                    ],
                },
            },
        ],
    )
