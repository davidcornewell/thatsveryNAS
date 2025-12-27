#!/usr/bin/python3

import pystache
import os
import urllib.parse
import config
from thatsverynas import ThatsVeryNAS

query_string = os.environ.get('QUERY_STRING', '')
params = urllib.parse.parse_qs(query_string)
page = params.get('page', [None])[0]
ajax = params.get('ajax', [None])[0]

print("Content-Type: text/html\r\n\r\n")

tvnas = ThatsVeryNAS(config)
renderer = pystache.Renderer()

if ajax == "savesubpath":
   path_id = params.get('path_id', [None])[0]
   path = params.get('path', [None])[0]
   tvnas.AddSubPath(path_id, path)
   
   print(renderer.render_path('templates/addedsubpath.mustache', {'path': path}))

else:
   print(renderer.render_path('templates/start.mustache', {'page': ''}))

   if page == "admin":
      paths = tvnas.GetPaths()
      print(renderer.render_path('templates/admin.mustache', {'paths': paths}))
   elif page == "files":
      print(renderer.render_path('templates/filesdatavis.mustache', {'page': ''}))
   elif page == "photos":
      print(renderer.render_path('templates/photofinder.mustache', {'page': ''}))
   else:
      print(renderer.render_path('templates/home.mustache', {'page': ''}))

   print(renderer.render_path('templates/end.mustache', {'page': ''}))
