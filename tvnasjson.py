#!/usr/bin/python3

import json
import os
import urllib.parse
from datetime import datetime
import config
from thatsverynas import ThatsVeryNAS

class DateTimeEncoder(json.JSONEncoder):
    def default(self, o):
        if isinstance(o, datetime):
            return o.isoformat(' ')

        return json.JSONEncoder.default(self, o)

tvnas = ThatsVeryNAS(config)
query_string = os.environ.get('QUERY_STRING', '')
params = urllib.parse.parse_qs(query_string)

searchopts = {
   "filename": params.get('filename', [None])[0],
   "status": "", #params.get('status', [''])[0],
   "types": params.get('types', []),
   "mainsearch": params.get('mainsearch', [None])[0],
   "date_from": params.get('date_from', [None])[0],  # YYYY-MM-DD
   "date_to": params.get('date_to', [None])[0],      # YYYY-MM-DD
   "min_faces": params.get('min_faces', ['0'])[0],  # minimum number of faces
   "on_this_day": params.get('on_this_day', [''])[0] == 'true'  # show photos from this day in all years
}

#if form_data.getfirst('path_id'):
#   searchopts["path_id"]=int(form_data.getfirst('path_id'))
#else:

searchopts["path_id"]=0

print("Content-Type: application/json\r\n\r\n")

files = tvnas.GetFiles(searchopts)

json_response=[]
for result in files["rows"]:
    json_response.append(dict(zip(files["columns"],result)))
    if json_response[len(json_response)-1]["face_data"]:
        json_response[len(json_response)-1]["face_data"] = json.loads(json_response[len(json_response)-1]["face_data"])

    if json_response[len(json_response)-1]["image_metadata"]:
        json_response[len(json_response)-1]["image_metadata"] = json.loads(json_response[len(json_response)-1]["image_metadata"])
        

print(json.dumps(json_response, indent=4, sort_keys=True, cls=DateTimeEncoder))

'''
json_response={"data": [], "typeInfo": []}

for col in files["columns"]:
    if col=="face_data":
        json_response["typeInfo"].append({"field": col, "type": "array"})
    else:
        json_response["typeInfo"].append({"field": col, "type": "string"})

for result in files["rows"]:
    json_response["data"].append(dict(zip(files["columns"],result)))

print(json.dumps(json_response, indent=4, sort_keys=True, cls=DateTimeEncoder))
'''
