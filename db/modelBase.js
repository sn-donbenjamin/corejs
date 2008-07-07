/**
usage:

foo = function( name ){
  this.name = name;
}

foo.prototype.blah = function(){

}

foo.__proto__ = new ModelBase( "foos" );

*/

// ------------

ModelBase = function( collectionName ){
    this.collectionName = collectionName;
};

ModelBase.prototype.__defineGetter__( "_c" , 
                                      function(){
                                          return db[this.collectionName];
                                      } );
    

// constructor stuff

ModelBase.prototype.__defineGetter__( "cons" ,
                                      function(){
                                          return this._cons;
                                      }
                                    );


ModelBase.prototype.__defineSetter__( "cons" ,
                                      function( cons ){
                                          this._cons = cons;
                                          this._c.setConstructor( cons );
                                          return cons;
                                      }
                                    );
                                          


// queries

ModelBase.prototype.findOne = function( key , create ){
    if ( ! key )
        return create ? new this.cons : null;

    if ( isString( key ) )
        key = ObjectId( key );
    
    return this._c.findOne( key );
};

ModelBase.prototype.find = function( key , fields ){
    return this._c.find( key , fields );
}

ModelBase.prototype.save = function(){
    return this._c.save( this );
}
