class thatsVeryNAS {
    constructor () {
    }

    // Adding a method to the constructor
    scanForFiles(path_id) {
		console.log('scan');
        return true;
    }
}
window['tvnas'] = new thatsVeryNAS();