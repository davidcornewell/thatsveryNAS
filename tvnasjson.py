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
   "mainsearch": form_data.getfirst('mainsearch')
}

#if form_data.getfirst('path_id'):
#   searchopts["path_id"]=int(form_data.getfirst('path_id'))
#else:

searchopts["path_id"]=0

print("Content-Type: application/json\r\n\r\n")

files = tvnas.GetFiles(searchopts)

json_response={"data": [], "typeInfo": []}

for col in files["columns"]:
    json_response["typeInfo"].append({"field": col, "type": "string"})

for result in files["rows"]:
    json_response["data"].append(dict(zip(files["columns"],result)))

print(json.dumps(json_response, indent=4, sort_keys=True, cls=DateTimeEncoder))
