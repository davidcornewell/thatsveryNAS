#!/usr/bin/python3

import json
import cgi
import cgitb; cgitb.enable()
from datetime import datetime
import config
from thatsverynas import ThatsVeryNAS

class DateTimeEncoder(json.JSONEncoder):
    def default(self, o):
        if isinstance(o, datetime):
            return o.isoformat(' ')

        return json.JSONEncoder.default(self, o)

tvnas = ThatsVeryNAS(config)
form_data = cgi.FieldStorage()

searchopts = {
   "filename": form_data.getfirst('filename'),
   "status": "", #form_data.getfirst('status'),
   "types": form_data.getlist('types'),
   "mainsearch": form_data.getfirst('mainsearch'),
   "date_from": form_data.getfirst('date_from'),  # YYYY-MM-DD
   "date_to": form_data.getfirst('date_to'),      # YYYY-MM-DD
   "min_faces": form_data.getfirst('min_faces', '0'),  # minimum number of faces
   "on_this_day": form_data.getfirst('on_this_day') == 'true'  # show photos from this day in all years
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
