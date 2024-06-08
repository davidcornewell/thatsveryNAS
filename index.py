#!/usr/bin/python3

import pystache
import cgi
import config
from thatsverynas import ThatsVeryNAS
# debug
import cgitb
cgitb.enable()

form = cgi.FieldStorage()
page = form.getvalue('page')
ajax = form.getvalue('ajax')

print("Content-Type: text/html\r\n\r\n")

tvnas = ThatsVeryNAS(config)
renderer = pystache.Renderer()

if ajax == "savesubpath":
   tvnas.AddSubPath(form.getvalue('path_id'), form.getvalue('path'))
   
   print(renderer.render_path('templates/addedsubpath.mustache', {'path': form.getvalue('path')}))

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
