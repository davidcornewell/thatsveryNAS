class thatsVeryNAS {
    constructor () {
    }

    // Adding a method to the constructor
    scanForFiles(path_id) {
		console.log('scan');
        return true;
    }

    addPath() {
        // Display a jQuery window to add a path
        var dlg = $('<div id="dlg_addpath" title="Add Path">');
        $( dlg ).dialog();
    }

    addSubPath(path_id, path) {
        // Display a jQuery window to add a Sub path
        var dlg = $('<div id="dlg_addsubpath" title="Add Sub Path to '+ path +'">'+
                    '<form onsubmit="window[\'tvnas\'].saveSubPath('+ path_id +', this.elements[\'subpath\'].value); return false;">'+
                    'Sub Path: <input type=text name="subpath">'+
                    '<input type=submit value="Save">'+
                    '</form></div>');
        $( dlg ).dialog();
    }

    saveSubPath(path_id, path) {
        $.ajax({
            method: "POST",
            url: "index.py",
            data: { ajax: "savesubpath", path_id: path_id, path: path }
          })
            .done(function( msg ) {
              if (msg.indexOf('<li>') >= 0) {
                
              }
              alert( "Data Saved: " + msg );
            });
    }
}
window['tvnas'] = new thatsVeryNAS();
