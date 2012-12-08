var Serializers = require('./serializers'),
    Deserializers = require('./deserializers');


/**
 * No-Operation
 * @private
 * @memberOf Marshal
 */
var NOOP = function(){};

/**
 * Returns the same value
 * @private
 * @memberOf Marshal
 */
var IDENTITY = function (val) { return val; };

/**
 * Supported types for marshalling
 * @private
 * @memberOf Marshal
 */
var TYPES = {
  'BytesType': { ser:Serializers.encodeBinary, de:Deserializers.decodeBinary },
  'LongType': { ser:Serializers.encodeLong, de:Deserializers.decodeLong },
  'IntegerType': { ser:Serializers.encodeInt32, de:Deserializers.decodeInt32 },
  'Int32Type': { ser:Serializers.encodeInt32, de:Deserializers.decodeInt32 },
  'UTF8Type': { ser:Serializers.encodeUTF8, de:Deserializers.decodeUTF8 },
  'AsciiType': { ser:Serializers.encodeAscii, de:Deserializers.decodeAscii },
  'LexicalUUIDType': { ser:Serializers.encodeUUID, de:Deserializers.decodeUUID },
  'TimeUUIDType': { ser:Serializers.encodeTimeUUID, de:Deserializers.decodeTimeUUID },
  'CounterColumnType': { ser:IDENTITY, de:Deserializers.decodeLong },
  'FloatType': { ser:Serializers.encodeFloat, de:Deserializers.decodeFloat },
  'DoubleType':{ ser:Serializers.encodeDouble, de:Deserializers.decodeDouble },
  'DecimalType':{ ser:Serializers.encodeDouble, de:Deserializers.decodeDouble },
  'DateType':{ ser:Serializers.encodeDate, de:Deserializers.decodeDate },
  'BooleanType':{ ser:Serializers.encodeBoolean, de:Deserializers.decodeBoolean },
  'UUIDType': { ser:Serializers.encodeUUID, de:Deserializers.decodeUUID },
  'CompositeType': { ser:NOOP, de:NOOP },
  'MapType': { ser:NOOP, de:NOOP },
  'SetType': { ser:NOOP, de:NOOP },
  'ReversedType': { ser:IDENTITY, de:IDENTITY }
};

/**
 * Given a string like org.apache.cassandra.db.marshal.UTF8Type
 * return a string of UTF8Type
 * @return {string} TypeName
 * @private
 * @memberOf Marshal
 */
function getType(str){
  var classes = str.split('.');
    return classes[classes.length - 1];

}

/**
 * Returns the type string inside of the parentheses
 * @private
 * @memberOf Marshal
 */
function getInnerType(str){
  var index = str.indexOf('(');
  return index > 0 ? str.substring(index + 1, str.length - 1) : str;
}

/**
 * Returns an array of types for composite columns
 * @private
 * @memberOf Marshal
 */
function getCompositeTypes(str){
  var type = getInnerType(str);
  if (type === str) {
    return getType(str);
  }

  var types = type.split(','),
      i = 0, ret = [], typeLength = types.length;

  for(; i < typeLength; i += 1){
    ret.push( getType(types[i]) );
  }

  return ret;
}

/**
 * Parses the type string and decides what types to return
 * @private
 * @memberOf Marshal
 */
function parseTypeString(type){
  if (type.indexOf('CompositeType') > -1){
    return getCompositeTypes(type);

  } else if(type.indexOf('ReversedType') > -1){
    return getInnerType(type);

  } else if (type.indexOf('SetType') != -1) {
    var innerType = getInnerType(type);
    var type = getType(innerType);
    return ['SetType', type]

  } else if (type.indexOf('MapType') != -1){
    var innerType = getInnerType(type);
    var type = getType(innerType);
    return ['MapType', type]

  } else if (type.indexOf('ListType') != -1){
    var innerType = getInnerType(type);
    var type = getType(innerType);
    return ['List', type]

  } else if(type === null || type === undefined) {
    return 'BytesType';
  } else {
    return getType(type);
  }
}

function collectionsSerializer(type, serializers) {
  // get the number of the elements on the list
  // remove the count from the buffer
  // use the type to parse the rest of the elements
  return function(vals) {
    return new Buffer('meow')
  }
}



/**
 * Creates a serializer for composite types
 * @private
 * @memberOf Marshal
 */
function compositeSerializer(serializers){
  return function(vals, sliceStart){
    var i = 0, buffers = [], totalLength = 0,
        valLength = vals.length, val;

    if(!Array.isArray(vals)){
      vals = [vals];
      valLength = vals.length;
    }

    for(; i < valLength; i += 1){
      if (Array.isArray(vals[i])){
        val = [serializers[i](vals[i][0]), vals[i][1]];
        totalLength += val[0].length + 3;
      } else {
        val = serializers[i](vals[i]);
        totalLength += val.length + 3;
      }

      buffers.push(val);
    }

    var buf = new Buffer(totalLength),
        buffersLength = buffers.length,
        writtenLength = 0, eoc, inclusive;

    i = 0;
    for(; i < buffersLength; i += 1){
      val = buffers[i];
      eoc = new Buffer('00', 'hex');
      inclusive = true;

      if (Array.isArray(val)){
        inclusive = val[1];
        val = val[0];
        if(inclusive){
          if (sliceStart){
            eoc = new Buffer('ff', 'hex');
          } else if (sliceStart === false){
            eoc = new Buffer('01', 'hex');
          }
        } else {
          if (sliceStart){
            eoc = new Buffer('01', 'hex');
          } else if (sliceStart === false){
            eoc = new Buffer('ff', 'hex');
          }
        }
      } else if (i === buffersLength - 1){
      if (sliceStart){
          eoc = new Buffer('ff', 'hex');
        } else if (sliceStart === false){
          eoc = new Buffer('01', 'hex');
        }
      }

      buf.writeUInt16BE(val.length, writtenLength);
      writtenLength += 2;
      val.copy(buf, writtenLength, 0);
      writtenLength += val.length;
      eoc.copy(buf, writtenLength, 0);
      writtenLength += 1;
    }

    return buf;
  };
}

function collectionsDeserializer(type, deserializers) {
  // get the number of the elements on the list
  // removkeye the count from the buffer
  // use the type to parse the rest of the elements


  var d = deserializers[0];


  if (type === 'SetType' || type === 'ListType') {
    return function(str) {
      if (str !== null) {
        var buf = new Buffer(str, 'binary');
        var pos = 0, len, vals = [];

        //collectionsLength = buf.readUInt16BE(0);
        pos = 2
        while(pos<buf.length) {
          len = buf.readUInt16BE(pos)
          pos += 2
          vals.push(d(buf.slice(pos, len + pos)))
          pos += len
        }
        return vals;
      } else {
        return []
      }
    }
  } else if (type === 'MapType') {
    return function(str) {
      if (str !== null) {
        var buf = new Buffer(str, 'binary');
        var pos = 0, len, map = {}, vals = [];
   
        pos = 2;

        while(pos < buf.length) {
          pos+=2
          len = buf.readUInt16BE(pos);
          pos += 2;
          vals.push(d(buf.slice(pos, len + pos)));
          pos += len;
        };

        // convert the array to map
        for (var i =0; i<vals.length;) {
          map[vals[i]] = vals[i+1];
          i += 2
        }

        return map

      } else {
        // XXX returns an empty map
        return {}
      }
    }
  }
}


/**
 * Creates a deserializer for composite types
 * @private
 * @memberOf Marshal
 */

function compositeDeserializer(deserializers){
  return function(str){
    var buf = new Buffer(str, 'binary'),
        pos = 0, len, vals = [], i = 0;

     while( pos < buf.length){
       len = buf.readUInt16BE(pos);
       pos += 2;
       vals.push(deserializers[i](buf.slice(pos, len + pos)));
       i += 1;
       pos += len + 1;
     }

    return vals;
  };
}

/**
 * Gets the serializer(s) for a specific type
 * @private
 * @memberOf Marshal
 */

function getSerializer(type){
  if (Array.isArray(type)){

    if (type[0] == "SetType") {
      // return serializers for the setType  
      return collectionsSerializer(type[0], [getSerializer(type[1])])

    } else if (type[0] == "MapType") {

      return collectionsSerializer(type[0], [getSerializer(type[1])])
    
    } else {
      var i = 0, typeLength = type.length, serializers = [];
      for(; i < typeLength; i += 1){
        serializers.push( getSerializer(type[i]));
      }
      return compositeSerializer(serializers);
    }
  } else {
    return TYPES[type].ser;
  }
}

/**
 * Gets the deserializer(s) for a specific type
 * @private
 * @memberOf Marshal
 */
function getDeserializer(type){
  if (Array.isArray(type)){
    if (type[0] === "SetType" || type[0] === "MapType" || type[0] === "ListType") {
      // return serializers for the setType  
      return collectionsDeserializer(type[0], [getDeserializer(type[1])]);
    } else {
      var i = 0, typeLength = type.length, deserializers = [];
      for(; i < typeLength; i += 1){
        deserializers.push( getDeserializer(type[i]));
      }
      return compositeDeserializer(deserializers);
    }
  } else {
    return function(val) {
      return val !== null ? TYPES[type].de(val) : null;
    }
  }
}

/**
 * Creates a Serialization/Deserialization object for a column family
 * @constructor
 * @param {String} type The type to create the marshaller for (eg. 'BytesType' or 'org.apache...CompositeType(BytesType,UTF8Type))
 */
var Marshal = function(type){
  var parsedType = parseTypeString(type);
  this.type = parsedType;

  /*
   * if t[0] == 'set'
   *  serialize the set type
   */

  if(Array.isArray(parsedType)){
    this.isComposite = true;
  } else {
    this.isComposite = false;
  }

  /**
   * Serializes data for the type specified
   * @param {Object} value(s) The value, or values if type is Composite, to serialize
   * @function
   */
  this.serialize = getSerializer(parsedType);

  /**
   * Deserializes data for the type specified
   * @param {Object} value(s) The value, or values if type is Composite, to deserialize
   * @function
   */
  this.deserialize = getDeserializer(parsedType);
};

module.exports = Marshal;
