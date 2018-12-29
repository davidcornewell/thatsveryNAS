import pystache

print "Content-Type: text/html"
print

renderer = pystache.Renderer()
print renderer.render_path('templates/main.mustache', {'page': ''})
