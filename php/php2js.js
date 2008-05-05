/* php2js

 */

core.util.string();
core.core.file();

function clone(x) { 
    return Object.extend({}, x);
}

// -------------------------------------------------------------------

var __file__ = "";
var inphp = 0; // in code block, or html mode?
var indents = 0;
var line = 1;

function indent() { 
    var s = "";
    for( var i = 0; i < indents; i++ )
	s += "  ";
    return s;
}

// -------------------------------------------------------------------

output = "";
input = "";
pos = 0; // input position

function printContext() { 
    print("line " + line + ":");
    var p = pos-1;
    var pad = "";
    while( p > 0 && input[p] != '\n' ) { 
	p--;
	pad = (input[p] == '\t' ? '\t' : ' ') + pad;
    }
    p++;
    print(pad + "*");
    for( var i = 0; i < 200; i++ ) { 
	if( p+i>=input.length )
	    break;
	var ch = input[p+i];
	if( ch == '\n' && i > 120 ) {
	    break;
	}
	printnoln(ch);
    }
    print('\n');
}

function say(x) { 
    output += x;
}
function sayTight(x) { 
    output = output.rtrim() + x;
}

// kind of like peek(), but not a single char.
function peekStream() { 
    return input.substring(pos);
}

function skipRequiredChar(x) { 
    var ch = get();
    if( ch != x ) 
	throw { unexpected: ch, wanted: x };
}

// returns true if skipped
function skipOptionalChar(x) { 
    var ch = peek();
    if( ch == x ) { 
	pop();
	return x;
    }
    return false;
}

function _skipTo(patt) { 
    var s = peekStream();
    var i = s.indexOf(patt);
    if( i < 0 ) { 
	throw("eof");
    }
    pos += i;
    var res = s.substring(0, i);
    line += res.nOccurrences('\n');
    return res;
}

function skipTo(patt) { 
    var s = peekStream();
    var i = s.indexOf(patt);

    if( i < 0 ) { 
	say(s);
	throw("eof");
    }
    var res = s.substring(0, i);
    say(res);
    line += res.nOccurrences('\n');
    pos += i;
}
function skipToAndEat(patt) { 
    skipTo(patt);
    pos += patt.length;
    line += patt.nOccurrences('\n');
}

/* sayskipped
     -1 return whitespace
     0 skip; don't output it
     1 skip, but output
*/
function peek(sayskipped) { 
    var il = input.length;
    while( 1 ) {
	if( pos >= il )
	    throw "eof";
	if( input[pos] == ' ' && sayskipped >= 0 ) { 
	    if( sayskipped ) say(input[pos]);
	    pos++; continue; 
	}
	return input[pos];
    }
}

function get(sayskipped) { 
    var ch = peek(sayskipped);
    pos++;
    if( ch == '\n' )
	line++;
    return ch;
}

function pushback() { 
    pos--; 
    if( input[pos] == '\n' ) line--;
}
function pop() { get(-1); }

/* run some code which outputs characters via say(); then return what 
   was output.
*/
function snoop(f) { 
    var len = output.length;
    f();
    return output.substring(len);
}

// -------------------------------------------------------------------

varTranslations = { 
    GLOBALS: "globals",
    _REQUEST: "request",
    _SERVER: "_server()"
};

// -------------------------------------------------------------------
// Tokens

number = { type: "number", str: "",
	   action: function() { say(this.str); }
};

// $SOMEVAR
variable = { type: "variable", name: "" ,
	     action: function(t) { say(t.name); },
	     init: function() 
	     { 
		 if( varTranslations[this.name] )
		     this.name = varTranslations[this.name];
	     }
};

other = { type: "other", str: "" } ; /* unclassified single char's */

phpend = { type: "phpend" } ; // "?>"

arrow = { type: "arrow" } ; // =>

linecomment = { type: "linecomment" }; // // or #

blockcomment = { type: "blockcomment" }; // slash *

singlequotestr = { type: "singlequotestr", stringval: "",
		   action: function(t) 
		   { 
		       say("'"); say(t.stringval); say("'");
		   }
};

doublequotestr = { type: "doublequotestr", stringval: "",
		   action: function(t) 
		   { 
		       // todo: expand vars
		       say('"'); say(t.stringval); say('"');
		   } 
};

/* keywords */
as = { type: "as" };
file = { type: "__file__", action: function() { say("'"+__file__+"'"); } };
define = { type: "define", action: doDefine };
require_once = { type: "require_once", action: doRequireOnce };
include_once = { type: "include_once", action: doRequireOnce };
include = { type: "include", action: doInclude }; // include "foo";
require = { type: "require", action: doInclude }; // include "foo";
foreach = { type: "foreach", action: forEach };
array = { type: "array", action: doArray };
echo = { type: "echo", action: doEcho };
keywords = [ define, require_once, include_once, require, include, foreach, array, echo,
	     file, as
];


// -------------------------------------------------------------------
// lexical

// set stringval to the string up to 'delimiter'
// tokobj is an examplar of the obj type we want
function strToTok(delimiter, tokobj) { 
    tokobj = clone(tokobj);
    tokobj.stringval = "";
    while( 1 ) { 
	var ch = get(-1);
	if( ch == delimiter ) break;
	tokobj.stringval += ch;
	if( ch == '\\' )
	    tokobj.stringval += get(-1);
    }
    return tokobj;
}

function delimChar(ch) {
    return "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_".indexOf(ch) < 0;
}

function getidentifier() { 
    var id = "";
    while( 1 ) { 
	var ch = peek(-1);
	if( delimChar(ch) ) break;
	id += ch;
	pop();
    }
    return id;
}

/* helper: if str matches, return a token of type tokobj */
function tokmatch(str, tokobj) { 
    var s = peekStream();
    if( !s.startsWithLC(str) ) return null;
    if( !delimChar(s[str.length]) ) return null;
    pos += str.length;
    line += str.nOccurrences('\n');
    return clone(tokobj);
}

function makeNumberToken(ch) { 
    var s = ch;
    var dots = 0;
    while( 1 ) { 
	ch = peek(-1);
	if( ch == '.' ) { 
	    if( ++dots > 1 )
		break;
	}
	else if( !isDigit(ch) )
	    break;
	s += ch;
	pop();
    }
    var n = clone(number);
    n.str = s;
    return n;
}

function tok(sayskipped) {
    var ch = get(sayskipped);
    if( isDigit(ch) || (ch == '-' && isDigit(peek(-1))) ) { 
	return makeNumberToken(ch);
    }
    else if( ch == '=' && peek(-1) == '>' ) { 
	get(-1); return clone(arrow);
    }
    else if( ch == '?' ) { 
	if( peek(-1) == '>' ) { get(); return clone(phpend); }
    }
    else if( ch == '#' ) { 
	return clone(linecomment);
    }
    else if( ch == '/' ) { 
	if( peek(-1) == '*' ) { get(); return clone(blockcomment); }
	if( peek(-1) == '/' ) { get(); return clone(linecomment); }
    }
    else if( ch == '"' ) { return strToTok('"', doublequotestr); }
    else if( ch == "'" ) { return strToTok("'", singlequotestr); }
    else if( ch == '$' ) { 
	var tk = clone(variable);
	tk.name = getidentifier();
	tk.init();
	return tk;
    }
    else {
	pushback();
	for( var i = 0; i < keywords.length; i++ ) { 
	    var examplar = keywords[i];
	    var tk = tokmatch(examplar.type, examplar);
	    if( tk ) 
		return tk;
	}
	pop();
    }
    var res = clone(other);
    res.str = ch.toLowerCase();
    return res;
}

function getString(sayskipped) {
    var t = tok(sayskipped);
    if( !t.stringval ) throw { unexpected: t, wanted: "string literal" };
    return t.stringval;
}

/* todo: it is ok if a comment is in front of some other expected token. 
   when that is true, just write out the comment and skip over.
*/
function expect(exptoken, str) { 
    var t = tok();
    if( t.type != exptoken.type || (str && t.str != str) ) {
	print("expected: " + exptoken.type + ' ' + (str?str:""));
	print("got: " + tojson(t));
	throw { unexpected: t, wanted: exptoken.type + ' ' + (str?str:"") };
    }
    return t;
}

function expectStr(s) { 
    s.forEach(function(x){expect(other,x);});
}

// -------------------------------------------------------------------

// define('PEAR_ERROR_RETURN',     1);
function doDefine() {
    expectStr("(");
    var l = getString(1);
    expectStr(",");
    say(l.toLowerCase() + " = ");
    doStatement(')', '(');
    expectStr(')');
}

function _includeParam() { 
    var skipped = skipOptionalChar('(');

    var x = filePrefix + getString();
    x = x.lessSuffix(".inc");
    x = x.lessSuffix(".php");
    x = x.lessPrefix("./");
    x = x.replace(/\//g, '.');

    if( skipped ) skipRequiredChar(')');

    return x;
}

function mark() { 
    return { p: pos, ln: line };
}
function rewind(mk) { 
    pos = mk.p;
    line = mk.ln;
}

function doInclude() {
    var mk = mark();
    try { 
	// try to do literal syntax which is more readable etc.
	say("jxp." + _includeParam() + "()");
    }
    catch( e if isObject(e) && e.unexpected ) { 
	// do nonliteral syntax
	rewind(mk);
	expectStr("(");
	say("require(");
	doStatement(")", "(");
    }
}

function doRequireOnce() { 
    var p = _includeParam();
    var path = p.replace(/\./g, '_');
    say("if( !_" + path + " ) { _" + path + " = true; ");
    say("jxp." + p + "()");
    say("; }");
    if( get() != ';' )
	pushback();
}

// php echo stmt
function doEcho() { 
    say("echo");
    if( peek() == '(' ) return;

    say('(');
    doStatement();
    sayTight(")");
    if( peek() != ';' ) say(";");
}

/* returns a variable name but can be things like
     foo
     foo->bar
     foo[3]
*/
function sayComplexVariable(inner) { 
    if( inner ) { 
	var id = getidentifier();
	print("ID:" + id);
	if( id == "" )
	    throw { unexpected: id, wanted: "identifier after ->" };
	say(id);
    }
    else {
	var v = expect(variable);
	say( v.name );
    }

    if( peek() == '-' ) { 
	pop(); 
	if( peek(-1) == '>' ) { 
	    pop();
	    say('.');
	    sayComplexVariable("inner");
	}
	else
	    push_back();
    }
    else if( peek() == '[' ) { 
	pop();
	say('[');
	doStatement(']', '[');
	expectStr(']');
	say(']');
    }
}

function markOutput() { 
    var pos = output.length;
    return function() { return pos; }
}
function injectInOutput(marker, str) {
    output = output.insert(marker(), str);
}

// array(1,2,3)
function doArray() {
    expectStr("(");
    say('[');
    php(')', '(');
    expectStr(")");
    say(']');
}

// php foreach( $a as $b [=> $c]  ) { }
function forEach() { 
    expectStr("(");
    var mko = markOutput();
    doStatement(as);
    expect(as);
    print("past AS " + inphp);

    var k = expect(variable); // $b
    var tk = tok(0);
    if( tk.type == "arrow" ) { 
	var v = expect(variable); // $c
	expectStr(")");
	injectInOutput(mko, "foreachkv(");
	say(", function("); 
	say(k.name + "," + v.name + ") ");  // foreachkv(a, function(b,c)) ...
    }
    else { 
	if( tk.str != ')' ) throw { unexpected: tk, wanted: ")" };
	injectInOutput(mko, "foreach(");
	say(", function(");
	say(k.name);
	say(") ");  // foreach(a, function(b)) ...
    }

    doBlock();
    say(" );");
}
/*
function forEachOld() { 
    expectStr("(");
    var coll = snoop( sayComplexVariable );
    expectStr("as");
    var k = expect(variable);
    say(".forEach( function(" + k.name + ") { ");

    var tk = tok(0);
    var v = null;
    if( tk.str == "=" ) { 
	expectStr(">");
	v = expect(variable);
	expectStr(")");
    }
    else if( tk.str != ")" )
	throw { unexpected: tk, wanted: ")" };
    expectStr("{");

    if( v ) { 
	say("\n  " + indent() + "var " + v.name + " = " + coll + "[" + k.name + "];\n");
    }

    doBlock();

    say(");");
    }*/
	
// -------------------------------------------------------------------

function skipToPhpTag() { 
    skipToAndEat("<?");
    if( peek(-1) == 'p' ) { 
	get(-1); get(-1); get(-1);
    }
    inphp++;
}

function doHtml() { 
    skipToPhpTag();
    say("<%");
}

/* endOn - character to stop processing the block on, and return.  however, 
           we can nest in further if starter chars are encountered.
           Can also be a token.

   eg you could call:

     php('}', '{');
     php(';', null);
*/
function php(endOn, starter) {
    var mydepth = 0;
    while( 1 ) { 
	try { 
	    var t = tok(1);
	    if( isObject(endOn) && t.type == endOn.type ) { 
		assert( t.type == "as" );
		pushback(); pushback();
		return t;
	    }
	    if( t.type == "other" ) {
		if( t.str == ':' && peek(-1) == ':' ) { 
		    get(-1); say('.'); continue; // ::
		}
		if( t.str == '-' && peek(-1) == '>' ) { 
		    get(-1); say('.'); continue; // ->
		}
		if( t.str == '.' ) { say("+"); continue; } // string concat
		if( t.str == starter )
		    mydepth++;
		else if( t.str == endOn ) { 
		    if( --mydepth < 0 ) {
			pushback();
			return;
		    }
		}
		say(t.str);
		continue;
	    }
	    if( t.type == "phpend" ) {
		inphp--; assert( inphp >= 0 );
		if( endOn ) { 
		    pushback(); pushback(); return;
		}
		say("%>");
		doHtml();
		continue;
	    }
	    if( t.type == "blockcomment" ) { 
		say("/*"); skipTo("*/"); continue;
	    }
	    if( t.type == "linecomment" ) { 
		say("//"); skipTo("\n"); continue;
	    }
	    if( t.action ) { 
		t.action(t); continue;
	    }
	    printnoln("***unhandled token:");
	    print(tojson(t)+"\n");
	    printContext();
	} catch( e if isObject(e) && e.unexpected ) { 
	    print("unexpected exception");
	    print(tojson(e));
	    printContext();
	    // TEMP: don't have to stop
	    throw "stopping";
	}
    }
}

/* run until end of statement. we are looking for a semicolon or ?> to terminate.
 */
function doStatement(endchar, starter) { 
    endchar = endchar || ';';
    php(endchar, starter);
}

/* we just started a { block } of code. (past the '{').
   process, then return. 
*/
function doBlock() { 
    expectStr("{"); say("{");
    indents++;
    php('}', '{');
    indents--;
    expectStr("}"); say("}"); 
}

// html mode at first.
function top() {
    try { 
	while( 1 ) {
	    skipToPhpTag();
	    say("<%");
	    php();
	}
    }
    catch( e if e == "eof" ) { 
    }

    if( inphp ) { 
	print("eof in php mode. adding %>");
	say("\n%>\n");
    }
}

//-----------------------------------------------------

function tojs(php, fname) { 
    line = 1;
    assert(fname);
    __file__ = fname;
    filePrefix = fname.replace(/^\/data\/sites\/[^\/]+\//, "");
    filePrefix = filePrefix.replace(/\/[^\/]+$/, "/");

    output = "";
    input = php;
    //    print(input); print("-----------------------------------");
    pos = 0;
    inphp = 0;
    top();
    return output;
}

//print( tojs('foo \n<?php x=2; \nin_Array(1,2);\n', "/data/sites/kz") );
//print( tojs('foo \n<?php x=2; \ninclude "includes/init.inc"; \n?> bar') );
//print( tojs("<?php\nforeach( $x->goo as $y=>$z ) { }", "/data/sites/kz") );
//print( tojs("<?php\nforeach( $x[$z] as $y ) { }", "/data/sites/kz") );


//var fname = "/data/sites/php/popslamui/lib/Config.php";
//var fname = "/data/sites/php/popslamui/lib/Cache/Cache.php";
//var fname = "/data/sites/php/popslamui/lib/Cache/PEAR.php";
var fname = javaStatic( "java.lang.System" , "getenv", "fname" );
//    "/data/sites/php/www/index.php";

var f = openFile( fname );
var code = f.getDataAsString();
var res = tojs(code, fname);

// output
var f = File.create(res);
var outname = fname.replace(/\.(php|inc)$/, ".jxp");
if( outname != fname ) {
    f.writeToLocalFile(outname);
    print("wrote to " + outname);
}
else {
    print("couldn't parse filename " + outname ); 
}

print("done");
exit();
