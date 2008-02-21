
Diff = {

    diff : function( a , b ){
        return javaStatic( "ed.util.DiffUtil" , "computeDiff" , a , b );
    } ,

    applyBackwards : function( base , diff ){
        return javaStatic( "ed.util.DiffUtil" , "applyScript" , base , diff );
    } ,

    test : function(){
        var a = "1\n2";
        var b = "1\n3";

        var d = Diff.diff( a , b );
        var n = Diff.applyBackwards( b , d );

        assert( a == n );
        return true;
    }
};
