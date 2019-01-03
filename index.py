#!/usr/bin/python

import pystache

print("Content-Type: text/html\r\n\r\n")

renderer = pystache.Renderer()
print(renderer.render_path('templates/main.mustache', {'page': ''}))
