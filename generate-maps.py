#!/usr/bin/python
import os
import json
import csv
from collections import defaultdict

from dateutil import parser
import simplekml
from shapely.geometry import mapping
from shapely.geometry import Point

year = 2021
data_path = "data/%s" % year
maps_path = "maps/%s" % year

dates = defaultdict(list)

for filename in os.listdir(data_path):
    if ".json" not in filename:
        continue

    with open(data_path + "/" + filename, "r") as f:
        data = json.load(f)

    for date in set(event["date"] for event in data["events"]):
        dates[date].append(data)

    if data["all_week"]:
        dates["all_week"].append(data)


for date, locations in dates.items():
    print("Writing %s..." % date)

    kml = simplekml.Kml()
    features = []

    for location in sorted(locations, key=lambda l: l["id"]):
        fully_booked = "Yes"

        start = None
        end = None

        # Choose the most open state
        # If any events are None it means we can't determine booking status
        for event in location["events"]:
            if event["date"] == date:
                # Ticket status
                if location["ticketed_events"]:
                    if fully_booked != "Unknown":
                        if event["fully_booked"] == False:
                            fully_booked = "No"
                        if event["fully_booked"] == None:
                            fully_booked = "Unknown"
                else:
                    fully_booked = ""

                # Open/close time
                event_start = parser.parse(event["start"])
                if not start or event_start < start:
                    start = event_start

                event_end = parser.parse(event["end"])
                if not end or event_end > end:
                    end = event_end

        start_time = None
        end_time = None
        if start and end:
            start_time = start.time().isoformat()
            end_time = end.time().isoformat()

        lat = location["location"]["latitude"]
        lon = location["location"]["longitude"]

        kml.newpoint(
            name=location["name"],
            coords=[(lon, lat)],
        )

        p = mapping(Point(float(lon), float(lat)))
        features.append(
            {
                "type": "Feature",
                "properties": {
                    "name": location["name"],
                    "url": location["original_url"],
                    "description": location["description"],
                    "ticketed_events": "Yes" if location["ticketed_events"] else "No",
                    "fully_booked": fully_booked,
                    "start": start_time,
                    "end": end_time,
                },
                "geometry": p,
            }
        )

    schema = {
        "type": "FeatureCollection",
        "features": features,
    }

    os.makedirs(maps_path + "/geojson", exist_ok=True)
    with open(maps_path + "/geojson/" + date + ".geojson", "w", encoding="utf-8") as f:
        f.write(
            json.dumps(
                schema,
                indent=4,
                sort_keys=True,
                separators=(",", ": "),
                ensure_ascii=False,
            )
        )

    os.makedirs(maps_path + "/kml", exist_ok=True)
    kml.save(maps_path + "/kml/" + date + ".kml")

with open(maps_path + "/dates.json", "w", encoding="utf-8") as f:
    f.write(json.dumps(sorted(list(dates.keys()))))
