app.wiki.WikiPage = function (name) {
    this.name = name || '';
    this.text = 'New WikiPage';
};

if (db) {
    db.wiki.ensureIndex( { name : 1 } );
    
    db.wiki.setConstructor( app.wiki.WikiPage );
}

/**
 * returns an array with the page name components split into an array
 */
app.wiki.WikiPage.prototype.getStructuredName = function() {
    return this.getDisplayName().split(/[.]/);
};

app.wiki.WikiPage.prototype.getDisplayName = function() {
    return this.name.replace(new RegExp('^' + moduleSettings.prefix), '');
};

app.wiki.WikiPage.prototype.getParsedText = function() {
    return app.wiki.WikiController.TEXT_PARSER.toHtml(this.text, moduleSettings.prefix);
};
