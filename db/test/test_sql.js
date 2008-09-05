/**
*      Copyright (C) 2008 10gen Inc.
*  
*    Licensed under the Apache License, Version 2.0 (the "License");
*    you may not use this file except in compliance with the License.
*    You may obtain a copy of the License at
*  
*       http://www.apache.org/licenses/LICENSE-2.0
*  
*    Unless required by applicable law or agreed to in writing, software
*    distributed under the License is distributed on an "AS IS" BASIS,
*    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
*    See the License for the specific language governing permissions and
*    limitations under the License.
*/

core.db.sql();

assert( isNumber( SQL._parseToNumber( "5" ) ) );
assert.eq( "=5" , SQL._parseToNumber( "=5" ) );

assert( isAlpha( "a" ) );
assert( ! isAlpha( "1" ) );
assert( isDigit( "1" ) );
assert( ! isDigit( "a" ) );
assert( ! isAlpha( "=" ) );
assert( ! isDigit( "=" ) );

t = new SQL.Tokenizer( "clicked = 1 " );
assert( "clicked" == t.nextToken() );
assert( "=" == t.nextToken() );
assert( 1 == t.nextToken() );
assert( null == t.nextToken() );


t = new SQL.Tokenizer( "clicked=1 " );
assert( "clicked" == t.nextToken() );
assert.eq( "=" , t.nextToken() );
assert( 1 == t.nextToken() );
assert( ! t.hasMore() );
assert( null == t.nextToken() );

t = new SQL.Tokenizer( "clicked2=1 " );
assert.eq( "clicked2" , t.nextToken() );
assert( "=" == t.nextToken() );
assert( 1 == t.nextToken() );
assert( ! t.hasMore() );
assert( null == t.nextToken() );

t = new SQL.Tokenizer( "clicked=1 and foo = 5" );
assert( "clicked" == t.nextToken() );
assert( "=" == t.nextToken() );
assert( 1 == t.nextToken() );
assert( "and" == t.nextToken() );
assert( "foo" == t.nextToken() );
assert( "=" == t.nextToken() );
var z = t.nextToken();
assert( 5 == z );
assert( isNumber( z ) );
assert( null == t.nextToken() );

f = SQL.parseWhere( "clicked = 1 " );
assert( f.clicked == 1 );

f = SQL.parseWhere( "clicked = 1 and z = 3" );
assert( f.clicked == 1 );
assert( f.z == 3 );

// ---- executeQuery testing ----

db = connect( "test_sql" );
db.basicSelect1.drop();
db.basicSelect1.save( { a : 1 , b : 2 } );

cursor = SQL.executeQuery( db , "select * from basicSelect1" );
assert.eq( 1 , cursor.length() );
assert.eq( 1 , cursor[0].a );
assert.eq( 2 , cursor[0].b );

cursor = SQL.executeQuery( db , "select b from basicSelect1" );
assert.eq( 1 , cursor.length() );
assert.eq( null , cursor[0].a );
assert.eq( 2 , cursor[0].b );

cursor = SQL.executeQuery( db , "select a  from basicSelect1" );
assert.eq( 1 , cursor.length() );
assert.eq( 1 , cursor[0].a );
assert.eq( null , cursor[0].b );

cursor = SQL.executeQuery( db , "select a , b from basicSelect1" );
assert.eq( 1 , cursor.length() );
assert.eq( 1 , cursor[0].a );
assert.eq( 2 , cursor[0].b );
