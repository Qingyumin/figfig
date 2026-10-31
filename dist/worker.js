// FigFig 1.0 Self-Contained Isomorphic Worker Bundle

var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// output/figlens/node_modules/kiwi-schema/kiwi.js
var require_kiwi = __commonJS({
  "output/figlens/node_modules/kiwi-schema/kiwi.js"(exports2, module2) {
    "use strict";
    var __defProp3 = Object.defineProperty;
    var __getOwnPropDesc3 = Object.getOwnPropertyDescriptor;
    var __getOwnPropNames3 = Object.getOwnPropertyNames;
    var __hasOwnProp3 = Object.prototype.hasOwnProperty;
    var __export = (target, all) => {
      for (var name in all)
        __defProp3(target, name, { get: all[name], enumerable: true });
    };
    var __copyProps3 = (to, from, except, desc) => {
      if (from && typeof from === "object" || typeof from === "function") {
        for (let key of __getOwnPropNames3(from))
          if (!__hasOwnProp3.call(to, key) && key !== except)
            __defProp3(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc3(from, key)) || desc.enumerable });
      }
      return to;
    };
    var __toCommonJS = (mod) => __copyProps3(__defProp3({}, "__esModule", { value: true }), mod);
    var kiwi_exports = {};
    __export(kiwi_exports, {
      ByteBuffer: () => ByteBuffer,
      compileSchema: () => compileSchema2,
      compileSchemaCPP: () => compileSchemaCPP,
      compileSchemaCallbackCPP: () => compileSchemaCallbackCPP,
      compileSchemaJS: () => compileSchemaJS,
      compileSchemaSkew: () => compileSchemaSkew,
      compileSchemaSkewTypes: () => compileSchemaSkewTypes,
      compileSchemaTypeScript: () => compileSchemaTypeScript,
      decodeBinarySchema: () => decodeBinarySchema2,
      encodeBinarySchema: () => encodeBinarySchema2,
      parseSchema: () => parseSchema,
      prettyPrintSchema: () => prettyPrintSchema
    });
    module2.exports = __toCommonJS(kiwi_exports);
    var int32 = new Int32Array(1);
    var float32 = new Float32Array(int32.buffer);
    var ByteBuffer = class {
      constructor(data) {
        if (data && !(data instanceof Uint8Array)) {
          throw new Error("Must initialize a ByteBuffer with a Uint8Array");
        }
        this._data = data || new Uint8Array(256);
        this._index = 0;
        this.length = data ? data.length : 0;
      }
      toUint8Array() {
        return this._data.subarray(0, this.length);
      }
      readByte() {
        if (this._index + 1 > this._data.length) {
          throw new Error("Index out of bounds");
        }
        return this._data[this._index++];
      }
      readByteArray() {
        let length = this.readVarUint();
        let start = this._index;
        let end = start + length;
        if (end > this._data.length) {
          throw new Error("Read array out of bounds");
        }
        this._index = end;
        let result = new Uint8Array(length);
        result.set(this._data.subarray(start, end));
        return result;
      }
      readVarFloat() {
        let index = this._index;
        let data = this._data;
        let length = data.length;
        if (index + 1 > length) {
          throw new Error("Index out of bounds");
        }
        let first = data[index];
        if (first === 0) {
          this._index = index + 1;
          return 0;
        }
        if (index + 4 > length) {
          throw new Error("Index out of bounds");
        }
        let bits2 = first | data[index + 1] << 8 | data[index + 2] << 16 | data[index + 3] << 24;
        this._index = index + 4;
        bits2 = bits2 << 23 | bits2 >>> 9;
        int32[0] = bits2;
        return float32[0];
      }
      readVarUint() {
        let value = 0;
        let shift = 0;
        do {
          var byte = this.readByte();
          value |= (byte & 127) << shift;
          shift += 7;
        } while (byte & 128 && shift < 35);
        return value >>> 0;
      }
      readVarInt() {
        let value = this.readVarUint() | 0;
        return value & 1 ? ~(value >>> 1) : value >>> 1;
      }
      readVarUint64() {
        let value = BigInt(0);
        let shift = BigInt(0);
        let seven = BigInt(7);
        let byte;
        while ((byte = this.readByte()) & 128 && shift < 56) {
          value |= BigInt(byte & 127) << shift;
          shift += seven;
        }
        value |= BigInt(byte) << shift;
        return value;
      }
      readVarInt64() {
        let value = this.readVarUint64();
        let one = BigInt(1);
        let sign = value & one;
        value >>= one;
        return sign ? ~value : value;
      }
      readString() {
        let result = "";
        while (true) {
          let codePoint;
          let a = this.readByte();
          if (a < 192) {
            codePoint = a;
          } else {
            let b = this.readByte();
            if (a < 224) {
              codePoint = (a & 31) << 6 | b & 63;
            } else {
              let c = this.readByte();
              if (a < 240) {
                codePoint = (a & 15) << 12 | (b & 63) << 6 | c & 63;
              } else {
                let d = this.readByte();
                codePoint = (a & 7) << 18 | (b & 63) << 12 | (c & 63) << 6 | d & 63;
              }
            }
          }
          if (codePoint === 0) {
            break;
          }
          if (codePoint < 65536) {
            result += String.fromCharCode(codePoint);
          } else {
            codePoint -= 65536;
            result += String.fromCharCode((codePoint >> 10) + 55296, (codePoint & (1 << 10) - 1) + 56320);
          }
        }
        return result;
      }
      _growBy(amount) {
        if (this.length + amount > this._data.length) {
          let data = new Uint8Array(this.length + amount << 1);
          data.set(this._data);
          this._data = data;
        }
        this.length += amount;
      }
      writeByte(value) {
        let index = this.length;
        this._growBy(1);
        this._data[index] = value;
      }
      writeByteArray(value) {
        this.writeVarUint(value.length);
        let index = this.length;
        this._growBy(value.length);
        this._data.set(value, index);
      }
      writeVarFloat(value) {
        let index = this.length;
        float32[0] = value;
        let bits2 = int32[0];
        bits2 = bits2 >>> 23 | bits2 << 9;
        if ((bits2 & 255) === 0) {
          this.writeByte(0);
          return;
        }
        this._growBy(4);
        let data = this._data;
        data[index] = bits2;
        data[index + 1] = bits2 >> 8;
        data[index + 2] = bits2 >> 16;
        data[index + 3] = bits2 >> 24;
      }
      writeVarUint(value) {
        if (value < 0 || value > 4294967295)
          throw new Error("Outside uint range: " + value);
        do {
          let byte = value & 127;
          value >>>= 7;
          this.writeByte(value ? byte | 128 : byte);
        } while (value);
      }
      writeVarInt(value) {
        if (value < -2147483648 || value > 2147483647)
          throw new Error("Outside int range: " + value);
        this.writeVarUint((value << 1 ^ value >> 31) >>> 0);
      }
      writeVarUint64(value) {
        if (typeof value === "string")
          value = BigInt(value);
        else if (typeof value !== "bigint")
          throw new Error("Expected bigint but got " + typeof value + ": " + value);
        if (value < 0 || value > BigInt("0xFFFFFFFFFFFFFFFF"))
          throw new Error("Outside uint64 range: " + value);
        let mask = BigInt(127);
        let seven = BigInt(7);
        for (let i = 0; value > mask && i < 8; i++) {
          this.writeByte(Number(value & mask) | 128);
          value >>= seven;
        }
        this.writeByte(Number(value));
      }
      writeVarInt64(value) {
        if (typeof value === "string")
          value = BigInt(value);
        else if (typeof value !== "bigint")
          throw new Error("Expected bigint but got " + typeof value + ": " + value);
        if (value < -BigInt("0x8000000000000000") || value > BigInt("0x7FFFFFFFFFFFFFFF"))
          throw new Error("Outside int64 range: " + value);
        let one = BigInt(1);
        this.writeVarUint64(value < 0 ? ~(value << one) : value << one);
      }
      writeString(value) {
        let codePoint;
        for (let i = 0; i < value.length; i++) {
          let a = value.charCodeAt(i);
          if (i + 1 === value.length || a < 55296 || a >= 56320) {
            codePoint = a;
          } else {
            let b = value.charCodeAt(++i);
            codePoint = (a << 10) + b + (65536 - (55296 << 10) - 56320);
          }
          if (codePoint === 0) {
            throw new Error("Cannot encode a string containing the null character");
          }
          if (codePoint < 128) {
            this.writeByte(codePoint);
          } else {
            if (codePoint < 2048) {
              this.writeByte(codePoint >> 6 & 31 | 192);
            } else {
              if (codePoint < 65536) {
                this.writeByte(codePoint >> 12 & 15 | 224);
              } else {
                this.writeByte(codePoint >> 18 & 7 | 240);
                this.writeByte(codePoint >> 12 & 63 | 128);
              }
              this.writeByte(codePoint >> 6 & 63 | 128);
            }
            this.writeByte(codePoint & 63 | 128);
          }
        }
        this.writeByte(0);
      }
    };
    function quote(text) {
      return JSON.stringify(text);
    }
    function error(text, line, column) {
      var error2 = new Error(text);
      error2.line = line;
      error2.column = column;
      throw error2;
    }
    function compileDecode(definition, definitions) {
      let lines = [];
      let indent = "  ";
      lines.push("function (bb) {");
      lines.push("  var result = {};");
      lines.push("  if (!(bb instanceof this.ByteBuffer)) {");
      lines.push("    bb = new this.ByteBuffer(bb);");
      lines.push("  }");
      lines.push("");
      if (definition.kind === "MESSAGE") {
        lines.push("  while (true) {");
        lines.push("    switch (bb.readVarUint()) {");
        lines.push("      case 0:");
        lines.push("        return result;");
        lines.push("");
        indent = "        ";
      }
      for (let i = 0; i < definition.fields.length; i++) {
        let field = definition.fields[i];
        let code;
        switch (field.type) {
          case "bool": {
            code = "!!bb.readByte()";
            break;
          }
          case "byte": {
            code = "bb.readByte()";
            break;
          }
          case "int": {
            code = "bb.readVarInt()";
            break;
          }
          case "uint": {
            code = "bb.readVarUint()";
            break;
          }
          case "float": {
            code = "bb.readVarFloat()";
            break;
          }
          case "string": {
            code = "bb.readString()";
            break;
          }
          case "int64": {
            code = "bb.readVarInt64()";
            break;
          }
          case "uint64": {
            code = "bb.readVarUint64()";
            break;
          }
          default: {
            let type = definitions[field.type];
            if (!type) {
              error("Invalid type " + quote(field.type) + " for field " + quote(field.name), field.line, field.column);
            } else if (type.kind === "ENUM") {
              code = "this[" + quote(type.name) + "][bb.readVarUint()]";
            } else {
              code = "this[" + quote("decode" + type.name) + "](bb)";
            }
          }
        }
        if (definition.kind === "MESSAGE") {
          lines.push("      case " + field.value + ":");
        }
        if (field.isArray) {
          if (field.isDeprecated) {
            if (field.type === "byte") {
              lines.push(indent + "bb.readByteArray();");
            } else {
              lines.push(indent + "var length = bb.readVarUint();");
              lines.push(indent + "while (length-- > 0) " + code + ";");
            }
          } else {
            if (field.type === "byte") {
              lines.push(indent + "result[" + quote(field.name) + "] = bb.readByteArray();");
            } else {
              lines.push(indent + "var length = bb.readVarUint();");
              lines.push(indent + "var values = result[" + quote(field.name) + "] = Array(length);");
              lines.push(indent + "for (var i = 0; i < length; i++) values[i] = " + code + ";");
            }
          }
        } else {
          if (field.isDeprecated) {
            lines.push(indent + code + ";");
          } else {
            lines.push(indent + "result[" + quote(field.name) + "] = " + code + ";");
          }
        }
        if (definition.kind === "MESSAGE") {
          lines.push("        break;");
          lines.push("");
        }
      }
      if (definition.kind === "MESSAGE") {
        lines.push("      default:");
        lines.push('        throw new Error("Attempted to parse invalid message");');
        lines.push("    }");
        lines.push("  }");
      } else {
        lines.push("  return result;");
      }
      lines.push("}");
      return lines.join("\n");
    }
    function compileEncode(definition, definitions) {
      let lines = [];
      lines.push("function (message, bb) {");
      lines.push("  var isTopLevel = !bb;");
      lines.push("  if (isTopLevel) bb = new this.ByteBuffer();");
      for (let j = 0; j < definition.fields.length; j++) {
        let field = definition.fields[j];
        let code;
        if (field.isDeprecated) {
          continue;
        }
        switch (field.type) {
          case "bool": {
            code = "bb.writeByte(value);";
            break;
          }
          case "byte": {
            code = "bb.writeByte(value);";
            break;
          }
          case "int": {
            code = "bb.writeVarInt(value);";
            break;
          }
          case "uint": {
            code = "bb.writeVarUint(value);";
            break;
          }
          case "float": {
            code = "bb.writeVarFloat(value);";
            break;
          }
          case "string": {
            code = "bb.writeString(value);";
            break;
          }
          case "int64": {
            code = "bb.writeVarInt64(value);";
            break;
          }
          case "uint64": {
            code = "bb.writeVarUint64(value);";
            break;
          }
          default: {
            let type = definitions[field.type];
            if (!type) {
              throw new Error("Invalid type " + quote(field.type) + " for field " + quote(field.name));
            } else if (type.kind === "ENUM") {
              code = "var encoded = this[" + quote(type.name) + '][value]; if (encoded === void 0) throw new Error("Invalid value " + JSON.stringify(value) + ' + quote(" for enum " + quote(type.name)) + "); bb.writeVarUint(encoded);";
            } else {
              code = "this[" + quote("encode" + type.name) + "](value, bb);";
            }
          }
        }
        lines.push("");
        lines.push("  var value = message[" + quote(field.name) + "];");
        lines.push("  if (value != null) {");
        if (definition.kind === "MESSAGE") {
          lines.push("    bb.writeVarUint(" + field.value + ");");
        }
        if (field.isArray) {
          if (field.type === "byte") {
            lines.push("    bb.writeByteArray(value);");
          } else {
            lines.push("    var values = value, n = values.length;");
            lines.push("    bb.writeVarUint(n);");
            lines.push("    for (var i = 0; i < n; i++) {");
            lines.push("      value = values[i];");
            lines.push("      " + code);
            lines.push("    }");
          }
        } else {
          lines.push("    " + code);
        }
        if (definition.kind === "STRUCT") {
          lines.push("  } else {");
          lines.push("    throw new Error(" + quote("Missing required field " + quote(field.name)) + ");");
        }
        lines.push("  }");
      }
      if (definition.kind === "MESSAGE") {
        lines.push("  bb.writeVarUint(0);");
      }
      lines.push("");
      lines.push("  if (isTopLevel) return bb.toUint8Array();");
      lines.push("}");
      return lines.join("\n");
    }
    function compileSchemaJS(schema) {
      let definitions = {};
      let name = schema.package;
      let js = [];
      if (name !== null) {
        js.push("var " + name + " = exports || " + name + " || {}, exports;");
      } else {
        js.push("var exports = exports || {};");
        name = "exports";
      }
      js.push(name + ".ByteBuffer = " + name + '.ByteBuffer || require("kiwi-schema").ByteBuffer;');
      for (let i = 0; i < schema.definitions.length; i++) {
        let definition = schema.definitions[i];
        definitions[definition.name] = definition;
      }
      for (let i = 0; i < schema.definitions.length; i++) {
        let definition = schema.definitions[i];
        switch (definition.kind) {
          case "ENUM": {
            let value = {};
            for (let j = 0; j < definition.fields.length; j++) {
              let field = definition.fields[j];
              value[field.name] = field.value;
              value[field.value] = field.name;
            }
            js.push(name + "[" + quote(definition.name) + "] = " + JSON.stringify(value, null, 2) + ";");
            break;
          }
          case "STRUCT":
          case "MESSAGE": {
            js.push("");
            js.push(name + "[" + quote("decode" + definition.name) + "] = " + compileDecode(definition, definitions) + ";");
            js.push("");
            js.push(name + "[" + quote("encode" + definition.name) + "] = " + compileEncode(definition, definitions) + ";");
            break;
          }
          default: {
            error("Invalid definition kind " + quote(definition.kind), definition.line, definition.column);
            break;
          }
        }
      }
      js.push("");
      return js.join("\n");
    }
    function compileSchema2(schema) {
      let result = {
        ByteBuffer
      };
      new Function("exports", compileSchemaJS(schema))(result);
      return result;
    }
    function argumentForField(definitions, type, name) {
      switch (type) {
        case "bool":
          return { type: "bool ", name };
        case "byte":
          return { type: "uint8_t ", name };
        case "int":
          return { type: "int32_t ", name };
        case "uint":
          return { type: "uint32_t ", name };
        case "float":
          return { type: "float ", name };
        case "string":
          return { type: "const char *", name };
        case "int64":
          return { type: "int64_t ", name };
        case "uint64":
          return { type: "uint64_t ", name };
        default: {
          let definition = definitions[type];
          if (definition.kind === "ENUM")
            return { type: definition.name + " ", name };
          return null;
        }
      }
    }
    function extractStructArguments(definitions, prefix, fields, allowArrays) {
      let args = [];
      for (let i = 0; i < fields.length; i++) {
        let field = fields[i];
        let name = prefix + field.name;
        if (field.isArray && !allowArrays) {
          return null;
        }
        let arg = argumentForField(definitions, field.type, name);
        if (arg !== null) {
          args.push(arg);
          continue;
        }
        let type = definitions[field.type];
        if (type.kind !== "STRUCT") {
          return null;
        }
        let typeArgs = extractStructArguments(definitions, name + "_", type.fields, false);
        if (typeArgs === null) {
          return null;
        }
        args.push.apply(args, typeArgs);
      }
      return args;
    }
    function argToDeclaration(arg) {
      return arg.type + arg.name;
    }
    function argToName(arg) {
      return arg.name;
    }
    function argToNotRead(arg) {
      switch (arg.type) {
        case "bool ":
        case "uint8_t ":
          return "!bb.readByte(" + arg.name + ")";
        case "int32_t ":
          return "!bb.readVarInt(" + arg.name + ")";
        case "uint32_t ":
          return "!bb.readVarUint(" + arg.name + ")";
        case "float ":
          return "!bb.readVarFloat(" + arg.name + ")";
        case "const char *":
          return "!bb.readString(" + arg.name + ")";
        case "int64_t ":
          return "!bb.readVarInt64(" + arg.name + ")";
        case "uint64_t ":
          return "!bb.readVarUint64(" + arg.name + ")";
        default:
          return "!bb.readVarUint(reinterpret_cast<uint32_t &>(" + arg.name + "))";
      }
    }
    function argToWrite(arg) {
      switch (arg.type) {
        case "bool ":
        case "uint8_t ":
          return "_bb.writeByte(" + arg.name + ")";
        case "int32_t ":
          return "_bb.writeVarInt(" + arg.name + ")";
        case "uint32_t ":
          return "_bb.writeVarUint(" + arg.name + ")";
        case "float ":
          return "_bb.writeVarFloat(" + arg.name + ")";
        case "const char *":
          return "_bb.writeString(" + arg.name + ")";
        case "int64_t ":
          return "_bb.writeVarInt64(" + arg.name + ")";
        case "uint64_t ":
          return "_bb.writeVarUint64(" + arg.name + ")";
        default:
          return "_bb.writeVarUint(static_cast<uint32_t>(" + arg.name + "))";
      }
    }
    function emitReadField(cpp, definitions, definition, field, indent) {
      let name = field.name;
      if (field.isArray) {
        let count = "_" + name + "_count";
        cpp.push(indent + "uint32_t " + count + ";");
        cpp.push(indent + "if (!bb.readVarUint(" + count + ")) return false;");
        if (!field.isDeprecated) {
          cpp.push(indent + "visitor.visit" + definition.name + "_" + field.name + "_count(" + count + ");");
        }
        cpp.push(indent + "while (" + count + "-- > 0) {");
        indent += "  ";
        name += "_element";
      }
      let args = extractStructArguments(definitions, "", [field], true);
      if (args !== null) {
        for (let i = 0; i < args.length; i++) {
          cpp.push(indent + argToDeclaration(args[i]) + ";");
        }
        cpp.push(indent + "if (" + args.map(argToNotRead).join(" || ") + ") return false;");
        if (!field.isDeprecated) {
          cpp.push(indent + "visitor.visit" + definition.name + "_" + name + "(" + args.map(argToName).join(", ") + ");");
        }
      } else {
        if (!field.isDeprecated) {
          cpp.push(indent + "visitor.visit" + definition.name + "_" + name + "();");
        }
        let type = definitions[field.type];
        cpp.push(indent + "if (!parse" + type.name + "(bb, visitor)) return false;");
      }
      if (field.isArray) {
        cpp.push(indent.slice(2) + "}");
      }
    }
    function compileSchemaCallbackCPP(schema) {
      let definitions = {};
      let cpp = [];
      for (let i = 0; i < schema.definitions.length; i++) {
        let definition = schema.definitions[i];
        definitions[definition.name] = definition;
      }
      if (schema.package !== null) {
        cpp.push("#ifndef INCLUDE_" + schema.package.toUpperCase() + "_H");
        cpp.push("#define INCLUDE_" + schema.package.toUpperCase() + "_H");
        cpp.push("");
      }
      cpp.push('#include "kiwi.h"');
      cpp.push("");
      if (schema.package !== null) {
        cpp.push("namespace " + schema.package + " {");
        cpp.push("");
      }
      for (let i = 0; i < schema.definitions.length; i++) {
        let definition = schema.definitions[i];
        if (definition.kind === "ENUM") {
          cpp.push("enum class " + definition.name + " : uint32_t {");
          for (let j = 0; j < definition.fields.length; j++) {
            let field = definition.fields[j];
            if (!field.isDeprecated) {
              cpp.push("  " + field.name + " = " + field.value + ",");
            }
          }
          cpp.push("};");
          cpp.push("");
        }
      }
      for (let pass = 0; pass < 2; pass++) {
        let suffix = ") = 0;";
        if (pass === 0) {
          cpp.push("class Visitor {");
          cpp.push("public:");
        } else {
          cpp.push("class Writer : public Visitor {");
          cpp.push("private:");
          cpp.push("  kiwi::ByteBuffer &_bb;");
          cpp.push("public:");
          cpp.push("  Writer(kiwi::ByteBuffer &bb) : _bb(bb) {}");
          suffix = ") override;";
        }
        for (let i = 0; i < schema.definitions.length; i++) {
          let definition = schema.definitions[i];
          if (definition.kind === "STRUCT") {
            let args = extractStructArguments(definitions, "", definition.fields, false);
            if (args !== null) {
              cpp.push("  virtual void visit" + definition.name + "(" + args.map(argToDeclaration).join(", ") + suffix);
              continue;
            }
          }
          if (definition.kind === "STRUCT" || definition.kind === "MESSAGE") {
            cpp.push("  virtual void begin" + definition.name + "(" + suffix);
            for (let j = 0; j < definition.fields.length; j++) {
              let field = definition.fields[j];
              if (field.isDeprecated) {
                continue;
              }
              let name = field.name;
              if (field.isArray) {
                cpp.push("  virtual void visit" + definition.name + "_" + field.name + "_count(uint32_t size" + suffix);
                name += "_element";
              }
              let args = extractStructArguments(definitions, "", [field], true);
              if (args !== null) {
                cpp.push("  virtual void visit" + definition.name + "_" + name + "(" + args.map(argToDeclaration).join(", ") + suffix);
              } else {
                cpp.push("  virtual void visit" + definition.name + "_" + name + "(" + suffix);
              }
            }
            cpp.push("  virtual void end" + definition.name + "(" + suffix);
          }
        }
        cpp.push("};");
        cpp.push("");
      }
      for (let i = 0; i < schema.definitions.length; i++) {
        let definition = schema.definitions[i];
        if (definition.kind === "STRUCT" || definition.kind === "MESSAGE") {
          cpp.push("bool parse" + definition.name + "(kiwi::ByteBuffer &bb, Visitor &visitor);");
        }
      }
      cpp.push("");
      cpp.push("#ifdef IMPLEMENT_SCHEMA_H");
      cpp.push("");
      for (let i = 0; i < schema.definitions.length; i++) {
        let definition = schema.definitions[i];
        if (definition.kind === "STRUCT") {
          let args = extractStructArguments(definitions, "", definition.fields, false);
          if (args !== null) {
            cpp.push("bool parse" + definition.name + "(kiwi::ByteBuffer &bb, Visitor &visitor) {");
            for (let j = 0; j < args.length; j++) {
              cpp.push("  " + argToDeclaration(args[j]) + ";");
            }
            cpp.push("  if (" + args.map(argToNotRead).join(" || ") + ") return false;");
            cpp.push("  visitor.visit" + definition.name + "(" + args.map(argToName).join(", ") + ");");
            cpp.push("  return true;");
            cpp.push("}");
            cpp.push("");
          } else {
            cpp.push("bool parse" + definition.name + "(kiwi::ByteBuffer &bb, Visitor &visitor) {");
            cpp.push("  visitor.begin" + definition.name + "();");
            for (let j = 0; j < definition.fields.length; j++) {
              let field = definition.fields[j];
              emitReadField(cpp, definitions, definition, field, "  ");
            }
            cpp.push("  visitor.end" + definition.name + "();");
            cpp.push("  return true;");
            cpp.push("}");
            cpp.push("");
          }
        } else if (definition.kind === "MESSAGE") {
          cpp.push("bool parse" + definition.name + "(kiwi::ByteBuffer &bb, Visitor &visitor) {");
          cpp.push("  visitor.begin" + definition.name + "();");
          cpp.push("  while (true) {");
          cpp.push("    uint32_t _type;");
          cpp.push("    if (!bb.readVarUint(_type)) return false;");
          cpp.push("    switch (_type) {");
          cpp.push("      case 0: {");
          cpp.push("        visitor.end" + definition.name + "();");
          cpp.push("        return true;");
          cpp.push("      }");
          for (let j = 0; j < definition.fields.length; j++) {
            let field = definition.fields[j];
            cpp.push("      case " + field.value + ": {");
            emitReadField(cpp, definitions, definition, field, "        ");
            cpp.push("        break;");
            cpp.push("      }");
          }
          cpp.push("      default: return false;");
          cpp.push("    }");
          cpp.push("  }");
          cpp.push("}");
          cpp.push("");
        }
      }
      for (let i = 0; i < schema.definitions.length; i++) {
        let definition = schema.definitions[i];
        if (definition.kind === "STRUCT") {
          let args = extractStructArguments(definitions, "", definition.fields, false);
          if (args !== null) {
            cpp.push("void Writer::visit" + definition.name + "(" + args.map(argToDeclaration).join(", ") + ") {");
            for (let j = 0; j < args.length; j++) {
              cpp.push("  " + argToWrite(args[j]) + ";");
            }
            cpp.push("}");
            cpp.push("");
            continue;
          }
        }
        if (definition.kind === "STRUCT" || definition.kind === "MESSAGE") {
          cpp.push("void Writer::begin" + definition.name + "() {");
          cpp.push("}");
          cpp.push("");
          for (let j = 0; j < definition.fields.length; j++) {
            let field = definition.fields[j];
            if (field.isDeprecated) {
              continue;
            }
            let name = field.name;
            if (field.isArray) {
              cpp.push("void Writer::visit" + definition.name + "_" + field.name + "_count(uint32_t size) {");
              if (definition.kind === "MESSAGE") {
                cpp.push("  _bb.writeVarUint(" + field.value + ");");
              }
              cpp.push("  _bb.writeVarUint(size);");
              cpp.push("}");
              cpp.push("");
              name += "_element";
            }
            let args = extractStructArguments(definitions, "", [field], true);
            if (args !== null) {
              cpp.push("void Writer::visit" + definition.name + "_" + name + "(" + args.map(argToDeclaration).join(", ") + ") {");
              if (definition.kind === "MESSAGE" && !field.isArray) {
                cpp.push("  _bb.writeVarUint(" + field.value + ");");
              }
              for (let k = 0; k < args.length; k++) {
                cpp.push("  " + argToWrite(args[k]) + ";");
              }
              cpp.push("}");
              cpp.push("");
            } else {
              cpp.push("void Writer::visit" + definition.name + "_" + name + "() {");
              if (definition.kind === "MESSAGE" && !field.isArray) {
                cpp.push("  _bb.writeVarUint(" + field.value + ");");
              }
              cpp.push("}");
              cpp.push("");
            }
          }
          cpp.push("void Writer::end" + definition.name + "() {");
          if (definition.kind === "MESSAGE") {
            cpp.push("  _bb.writeVarUint(0);");
          }
          cpp.push("}");
          cpp.push("");
        }
      }
      cpp.push("#endif");
      cpp.push("");
      if (schema.package !== null) {
        cpp.push("}");
        cpp.push("");
        cpp.push("#endif");
        cpp.push("");
      }
      return cpp.join("\n");
    }
    function cppType(definitions, field, isArray) {
      let type;
      switch (field.type) {
        case "bool":
          type = "bool";
          break;
        case "byte":
          type = "uint8_t";
          break;
        case "int":
          type = "int32_t";
          break;
        case "uint":
          type = "uint32_t";
          break;
        case "float":
          type = "float";
          break;
        case "string":
          type = "kiwi::String";
          break;
        case "int64":
          type = "int64_t";
          break;
        case "uint64":
          type = "uint64_t";
          break;
        default: {
          let definition = definitions[field.type];
          if (!definition) {
            error("Invalid type " + quote(field.type) + " for field " + quote(field.name), field.line, field.column);
          }
          type = definition.name;
          break;
        }
      }
      if (isArray) {
        type = "kiwi::Array<" + type + ">";
      }
      return type;
    }
    function cppFieldName(field) {
      return "_data_" + field.name;
    }
    function cppFlagIndex(i) {
      return i >> 5;
    }
    function cppFlagMask(i) {
      return 1 << i % 32 >>> 0;
    }
    function cppIsFieldPointer(definitions, field) {
      return !field.isArray && field.type in definitions && definitions[field.type].kind !== "ENUM";
    }
    function compileSchemaCPP(schema) {
      let definitions = {};
      let cpp = [];
      cpp.push('#include "kiwi.h"');
      cpp.push("");
      if (schema.package !== null) {
        cpp.push("namespace " + schema.package + " {");
        cpp.push("");
        cpp.push("#ifndef INCLUDE_" + schema.package.toUpperCase() + "_H");
        cpp.push("#define INCLUDE_" + schema.package.toUpperCase() + "_H");
        cpp.push("");
      }
      for (let i = 0; i < schema.definitions.length; i++) {
        let definition = schema.definitions[i];
        definitions[definition.name] = definition;
      }
      cpp.push("class BinarySchema {");
      cpp.push("public:");
      cpp.push("  bool parse(kiwi::ByteBuffer &bb);");
      cpp.push("  const kiwi::BinarySchema &underlyingSchema() const { return _schema; }");
      for (let i = 0; i < schema.definitions.length; i++) {
        let definition = schema.definitions[i];
        if (definition.kind === "MESSAGE") {
          cpp.push("  bool skip" + definition.name + "Field(kiwi::ByteBuffer &bb, uint32_t id) const;");
        }
      }
      cpp.push("");
      cpp.push("private:");
      cpp.push("  kiwi::BinarySchema _schema;");
      for (let i = 0; i < schema.definitions.length; i++) {
        let definition = schema.definitions[i];
        if (definition.kind === "MESSAGE") {
          cpp.push("  uint32_t _index" + definition.name + " = 0;");
        }
      }
      cpp.push("};");
      cpp.push("");
      for (let i = 0; i < schema.definitions.length; i++) {
        let definition = schema.definitions[i];
        if (definition.kind === "ENUM") {
          cpp.push("enum class " + definition.name + " : uint32_t {");
          for (let j = 0; j < definition.fields.length; j++) {
            let field = definition.fields[j];
            cpp.push("  " + field.name + " = " + field.value + ",");
          }
          cpp.push("};");
          cpp.push("");
        } else if (definition.kind !== "STRUCT" && definition.kind !== "MESSAGE") {
          error("Invalid definition kind " + quote(definition.kind), definition.line, definition.column);
        }
      }
      for (let pass = 0; pass < 3; pass++) {
        let newline = false;
        if (pass === 2) {
          if (schema.package !== null) {
            cpp.push("#endif");
          }
          cpp.push("#ifdef IMPLEMENT_SCHEMA_H");
          cpp.push("");
          cpp.push("bool BinarySchema::parse(kiwi::ByteBuffer &bb) {");
          cpp.push("  if (!_schema.parse(bb)) return false;");
          for (let i = 0; i < schema.definitions.length; i++) {
            let definition = schema.definitions[i];
            if (definition.kind === "MESSAGE") {
              cpp.push('  _schema.findDefinition("' + definition.name + '", _index' + definition.name + ");");
            }
          }
          cpp.push("  return true;");
          cpp.push("}");
          cpp.push("");
          for (let i = 0; i < schema.definitions.length; i++) {
            let definition = schema.definitions[i];
            if (definition.kind === "MESSAGE") {
              cpp.push("bool BinarySchema::skip" + definition.name + "Field(kiwi::ByteBuffer &bb, uint32_t id) const {");
              cpp.push("  return _schema.skipField(bb, _index" + definition.name + ", id);");
              cpp.push("}");
              cpp.push("");
            }
          }
        }
        for (let i = 0; i < schema.definitions.length; i++) {
          let definition = schema.definitions[i];
          if (definition.kind === "ENUM") {
            continue;
          }
          let fields = definition.fields;
          if (pass === 0) {
            cpp.push("class " + definition.name + ";");
            newline = true;
          } else if (pass === 1) {
            cpp.push("class " + definition.name + " {");
            cpp.push("public:");
            cpp.push("  " + definition.name + "() { (void)_flags; }");
            cpp.push("");
            for (let j = 0; j < fields.length; j++) {
              let field = fields[j];
              if (field.isDeprecated) {
                continue;
              }
              let type = cppType(definitions, field, field.isArray);
              if (cppIsFieldPointer(definitions, field)) {
                cpp.push("  " + type + " *" + field.name + "();");
                cpp.push("  const " + type + " *" + field.name + "() const;");
                cpp.push("  void set_" + field.name + "(" + type + " *value);");
              } else if (field.isArray) {
                cpp.push("  " + type + " *" + field.name + "();");
                cpp.push("  const " + type + " *" + field.name + "() const;");
                cpp.push("  " + type + " &set_" + field.name + "(kiwi::MemoryPool &pool, uint32_t count);");
              } else {
                cpp.push("  " + type + " *" + field.name + "();");
                cpp.push("  const " + type + " *" + field.name + "() const;");
                cpp.push("  void set_" + field.name + "(const " + type + " &value);");
              }
              cpp.push("");
            }
            cpp.push("  bool encode(kiwi::ByteBuffer &bb);");
            cpp.push("  bool decode(kiwi::ByteBuffer &bb, kiwi::MemoryPool &pool, const BinarySchema *schema = nullptr);");
            cpp.push("");
            cpp.push("private:");
            cpp.push("  uint32_t _flags[" + (fields.length + 31 >> 5) + "] = {};");
            let sizes = { "bool": 1, "byte": 1, "int": 4, "uint": 4, "float": 4 };
            let sortedFields = fields.slice().sort(function(a, b) {
              let sizeA = !a.isArray && sizes[a.type] || 8;
              let sizeB = !b.isArray && sizes[b.type] || 8;
              if (sizeA !== sizeB)
                return sizeB - sizeA;
              return fields.indexOf(a) - fields.indexOf(b);
            });
            for (let j = 0; j < sortedFields.length; j++) {
              let field = sortedFields[j];
              if (field.isDeprecated) {
                continue;
              }
              let name = cppFieldName(field);
              let type = cppType(definitions, field, field.isArray);
              if (cppIsFieldPointer(definitions, field)) {
                cpp.push("  " + type + " *" + name + " = {};");
              } else {
                cpp.push("  " + type + " " + name + " = {};");
              }
            }
            cpp.push("};");
            cpp.push("");
          } else {
            for (let j = 0; j < fields.length; j++) {
              let field = fields[j];
              let name = cppFieldName(field);
              let type = cppType(definitions, field, field.isArray);
              let flagIndex = cppFlagIndex(j);
              let flagMask = cppFlagMask(j);
              if (field.isDeprecated) {
                continue;
              }
              if (cppIsFieldPointer(definitions, field)) {
                cpp.push(type + " *" + definition.name + "::" + field.name + "() {");
                cpp.push("  return " + name + ";");
                cpp.push("}");
                cpp.push("");
                cpp.push("const " + type + " *" + definition.name + "::" + field.name + "() const {");
                cpp.push("  return " + name + ";");
                cpp.push("}");
                cpp.push("");
                cpp.push("void " + definition.name + "::set_" + field.name + "(" + type + " *value) {");
                cpp.push("  " + name + " = value;");
                cpp.push("}");
                cpp.push("");
              } else if (field.isArray) {
                cpp.push(type + " *" + definition.name + "::" + field.name + "() {");
                cpp.push("  return _flags[" + flagIndex + "] & " + flagMask + " ? &" + name + " : nullptr;");
                cpp.push("}");
                cpp.push("");
                cpp.push("const " + type + " *" + definition.name + "::" + field.name + "() const {");
                cpp.push("  return _flags[" + flagIndex + "] & " + flagMask + " ? &" + name + " : nullptr;");
                cpp.push("}");
                cpp.push("");
                cpp.push(type + " &" + definition.name + "::set_" + field.name + "(kiwi::MemoryPool &pool, uint32_t count) {");
                cpp.push("  _flags[" + flagIndex + "] |= " + flagMask + "; return " + name + " = pool.array<" + cppType(definitions, field, false) + ">(count);");
                cpp.push("}");
                cpp.push("");
              } else {
                cpp.push(type + " *" + definition.name + "::" + field.name + "() {");
                cpp.push("  return _flags[" + flagIndex + "] & " + flagMask + " ? &" + name + " : nullptr;");
                cpp.push("}");
                cpp.push("");
                cpp.push("const " + type + " *" + definition.name + "::" + field.name + "() const {");
                cpp.push("  return _flags[" + flagIndex + "] & " + flagMask + " ? &" + name + " : nullptr;");
                cpp.push("}");
                cpp.push("");
                cpp.push("void " + definition.name + "::set_" + field.name + "(const " + type + " &value) {");
                cpp.push("  _flags[" + flagIndex + "] |= " + flagMask + "; " + name + " = value;");
                cpp.push("}");
                cpp.push("");
              }
            }
            cpp.push("bool " + definition.name + "::encode(kiwi::ByteBuffer &_bb) {");
            for (let j = 0; j < fields.length; j++) {
              let field = fields[j];
              if (field.isDeprecated) {
                continue;
              }
              let name = cppFieldName(field);
              let value = field.isArray ? "_it" : name;
              let flagIndex = cppFlagIndex(j);
              let flagMask = cppFlagMask(j);
              let code;
              switch (field.type) {
                case "bool": {
                  code = "_bb.writeByte(" + value + ");";
                  break;
                }
                case "byte": {
                  code = "_bb.writeByte(" + value + ");";
                  break;
                }
                case "int": {
                  code = "_bb.writeVarInt(" + value + ");";
                  break;
                }
                case "uint": {
                  code = "_bb.writeVarUint(" + value + ");";
                  break;
                }
                case "float": {
                  code = "_bb.writeVarFloat(" + value + ");";
                  break;
                }
                case "string": {
                  code = "_bb.writeString(" + value + ".c_str());";
                  break;
                }
                case "int64": {
                  code = "_bb.writeVarInt64(" + value + ");";
                  break;
                }
                case "uint64": {
                  code = "_bb.writeVarUint64(" + value + ");";
                  break;
                }
                default: {
                  let type = definitions[field.type];
                  if (!type) {
                    error("Invalid type " + quote(field.type) + " for field " + quote(field.name), field.line, field.column);
                  } else if (type.kind === "ENUM") {
                    code = "_bb.writeVarUint(static_cast<uint32_t>(" + value + "));";
                  } else {
                    code = "if (!" + value + (cppIsFieldPointer(definitions, field) ? "->" : ".") + "encode(_bb)) return false;";
                  }
                }
              }
              let indent = "  ";
              if (definition.kind === "STRUCT") {
                cpp.push("  if (" + field.name + "() == nullptr) return false;");
              } else {
                cpp.push("  if (" + field.name + "() != nullptr) {");
                indent = "    ";
              }
              if (definition.kind === "MESSAGE") {
                cpp.push(indent + "_bb.writeVarUint(" + field.value + ");");
              }
              if (field.isArray) {
                cpp.push(indent + "_bb.writeVarUint(" + name + ".size());");
                cpp.push(indent + "for (" + cppType(definitions, field, false) + " &_it : " + name + ") " + code);
              } else {
                cpp.push(indent + code);
              }
              if (definition.kind !== "STRUCT") {
                cpp.push("  }");
              }
            }
            if (definition.kind === "MESSAGE") {
              cpp.push("  _bb.writeVarUint(0);");
            }
            cpp.push("  return true;");
            cpp.push("}");
            cpp.push("");
            cpp.push("bool " + definition.name + "::decode(kiwi::ByteBuffer &_bb, kiwi::MemoryPool &_pool, const BinarySchema *_schema) {");
            for (let j = 0; j < fields.length; j++) {
              if (fields[j].isArray) {
                cpp.push("  uint32_t _count;");
                break;
              }
            }
            if (definition.kind === "MESSAGE") {
              cpp.push("  while (true) {");
              cpp.push("    uint32_t _type;");
              cpp.push("    if (!_bb.readVarUint(_type)) return false;");
              cpp.push("    switch (_type) {");
              cpp.push("      case 0:");
              cpp.push("        return true;");
            }
            for (let j = 0; j < fields.length; j++) {
              let field = fields[j];
              let name = cppFieldName(field);
              let value = field.isArray ? "_it" : name;
              let isPointer = cppIsFieldPointer(definitions, field);
              let code;
              switch (field.type) {
                case "bool": {
                  code = "_bb.readByte(" + value + ")";
                  break;
                }
                case "byte": {
                  code = "_bb.readByte(" + value + ")";
                  break;
                }
                case "int": {
                  code = "_bb.readVarInt(" + value + ")";
                  break;
                }
                case "uint": {
                  code = "_bb.readVarUint(" + value + ")";
                  break;
                }
                case "float": {
                  code = "_bb.readVarFloat(" + value + ")";
                  break;
                }
                case "string": {
                  code = "_bb.readString(" + value + ", _pool)";
                  break;
                }
                case "int64": {
                  code = "_bb.readVarInt64(" + value + ")";
                  break;
                }
                case "uint64": {
                  code = "_bb.readVarUint64(" + value + ")";
                  break;
                }
                default: {
                  let type2 = definitions[field.type];
                  if (!type2) {
                    error("Invalid type " + quote(field.type) + " for field " + quote(field.name), field.line, field.column);
                  } else if (type2.kind === "ENUM") {
                    code = "_bb.readVarUint(reinterpret_cast<uint32_t &>(" + value + "))";
                  } else {
                    code = value + (isPointer ? "->" : ".") + "decode(_bb, _pool, _schema)";
                  }
                }
              }
              let type = cppType(definitions, field, false);
              let indent = "  ";
              if (definition.kind === "MESSAGE") {
                cpp.push("      case " + field.value + ": {");
                indent = "        ";
              }
              if (field.isArray) {
                cpp.push(indent + "if (!_bb.readVarUint(_count)) return false;");
                if (field.isDeprecated) {
                  cpp.push(indent + "for (" + type + " &_it : _pool.array<" + cppType(definitions, field, false) + ">(_count)) if (!" + code + ") return false;");
                } else {
                  cpp.push(indent + "for (" + type + " &_it : set_" + field.name + "(_pool, _count)) if (!" + code + ") return false;");
                }
              } else {
                if (field.isDeprecated) {
                  if (isPointer) {
                    cpp.push(indent + type + " *" + name + " = _pool.allocate<" + type + ">();");
                  } else {
                    cpp.push(indent + type + " " + name + " = {};");
                  }
                  cpp.push(indent + "if (!" + code + ") return false;");
                } else {
                  if (isPointer) {
                    cpp.push(indent + name + " = _pool.allocate<" + type + ">();");
                  }
                  cpp.push(indent + "if (!" + code + ") return false;");
                  if (!isPointer) {
                    cpp.push(indent + "set_" + field.name + "(" + name + ");");
                  }
                }
              }
              if (definition.kind === "MESSAGE") {
                cpp.push("        break;");
                cpp.push("      }");
              }
            }
            if (definition.kind === "MESSAGE") {
              cpp.push("      default: {");
              cpp.push("        if (!_schema || !_schema->skip" + definition.name + "Field(_bb, _type)) return false;");
              cpp.push("        break;");
              cpp.push("      }");
              cpp.push("    }");
              cpp.push("  }");
            } else {
              cpp.push("  return true;");
            }
            cpp.push("}");
            cpp.push("");
          }
        }
        if (pass === 2) {
          cpp.push("#endif");
          cpp.push("");
        } else if (newline)
          cpp.push("");
      }
      if (schema.package !== null) {
        cpp.push("}");
        cpp.push("");
      }
      return cpp.join("\n");
    }
    function popTrailingNewline(lines) {
      if (lines[lines.length - 1] === "") {
        lines.pop();
      }
    }
    function skewDefaultValueForField(definitions, field) {
      if (field.isArray) {
        return "null";
      }
      switch (field.type) {
        case "bool":
          return "false";
        case "byte":
        case "int":
        case "uint":
          return "0";
        case "float":
          return "0.0";
        case "string":
          return "null";
        case "int64":
        case "uint64":
          return "BigInt.new(0)";
      }
      let def = definitions[field.type];
      if (def.kind === "ENUM") {
        if (def.fields.length > 0) {
          return "." + def.fields[0].name;
        }
        return "0 as " + field.type;
      }
      return "null";
    }
    function skewTypeForField(field) {
      let type;
      switch (field.type) {
        case "bool":
          type = "bool";
          break;
        case "byte":
        case "int":
        case "uint":
          type = "int";
          break;
        case "float":
          type = "double";
          break;
        case "string":
          type = "string";
          break;
        case "int64":
        case "uint64":
          type = "BigInt";
          break;
        default:
          type = field.type;
          break;
      }
      if (field.isArray) {
        type = "List<" + type + ">";
      }
      return type;
    }
    function compileSchemaSkew(schema) {
      let definitions = {};
      let indent = "";
      let lines = [];
      if (schema.package !== null) {
        lines.push("namespace " + schema.package + " {");
        indent += "  ";
      }
      for (let i = 0; i < schema.definitions.length; i++) {
        let definition = schema.definitions[i];
        definitions[definition.name] = definition;
      }
      lines.push(indent + "class BinarySchema {");
      lines.push(indent + "  var _schema = Kiwi.BinarySchema.new");
      for (let i = 0; i < schema.definitions.length; i++) {
        let definition = schema.definitions[i];
        if (definition.kind === "MESSAGE") {
          lines.push(indent + "  var _index" + definition.name + " = 0");
        }
      }
      lines.push("");
      lines.push(indent + "  def parse(bytes Uint8Array) {");
      lines.push(indent + "    _schema.parse(Kiwi.ByteBuffer.new(bytes))");
      for (let i = 0; i < schema.definitions.length; i++) {
        let definition = schema.definitions[i];
        if (definition.kind === "MESSAGE") {
          lines.push(indent + "    _index" + definition.name + ' = _schema.findDefinition("' + definition.name + '")');
        }
      }
      lines.push(indent + "  }");
      for (let i = 0; i < schema.definitions.length; i++) {
        let definition = schema.definitions[i];
        if (definition.kind === "MESSAGE") {
          lines.push("");
          lines.push(indent + "  def skip" + definition.name + "Field(bb Kiwi.ByteBuffer, id int) {");
          lines.push(indent + "    _schema.skipField(bb, _index" + definition.name + ", id)");
          lines.push(indent + "  }");
        }
      }
      lines.push(indent + "}");
      lines.push("");
      for (let i = 0; i < schema.definitions.length; i++) {
        let definition = schema.definitions[i];
        switch (definition.kind) {
          case "ENUM": {
            let encode = {};
            let decode = {};
            lines.push(indent + "enum " + definition.name + " {");
            for (let j = 0; j < definition.fields.length; j++) {
              let field = definition.fields[j];
              encode[field.name] = field.value;
              decode[field.value] = field.name;
              lines.push(indent + "  " + field.name);
            }
            lines.push(indent + "}");
            lines.push("");
            lines.push(indent + "namespace " + definition.name + " {");
            lines.push(indent + "  const _encode = " + JSON.stringify(encode, null, 2).replace(/"/g, "").replace(/\n/g, "\n  " + indent));
            lines.push("");
            lines.push(indent + "  const _decode = " + JSON.stringify(decode, null, 2).replace(/"/g, "").replace(/\n/g, "\n  " + indent));
            lines.push("");
            lines.push(indent + "  def encode(value " + definition.name + ") int {");
            lines.push(indent + "    return _encode[value]");
            lines.push(indent + "  }");
            lines.push("");
            lines.push(indent + "  def decode(value int) " + definition.name + " {");
            lines.push(indent + "    if !(value in _decode) {");
            lines.push(indent + "      Kiwi.DecodeError.throwInvalidEnumValue(" + quote(definition.name) + ")");
            lines.push(indent + "    }");
            lines.push(indent + "    return _decode[value]");
            lines.push(indent + "  }");
            lines.push(indent + "}");
            lines.push("");
            break;
          }
          case "STRUCT":
          case "MESSAGE": {
            lines.push(indent + "class " + definition.name + " {");
            for (let j = 0; j < definition.fields.length; j += 32) {
              lines.push(indent + "  var _flags" + (j >> 5) + " = 0");
            }
            for (let j = 0; j < definition.fields.length; j++) {
              let field = definition.fields[j];
              if (field.isDeprecated) {
                continue;
              }
              lines.push(indent + "  var _" + field.name + " " + skewTypeForField(field) + " = " + skewDefaultValueForField(definitions, field));
            }
            lines.push("");
            for (let j = 0; j < definition.fields.length; j++) {
              let field = definition.fields[j];
              if (field.isDeprecated) {
                continue;
              }
              let type = skewTypeForField(field);
              let flags = "_flags" + (j >> 5);
              let mask = "" + (1 << j % 32 >>> 0);
              lines.push(indent + "  def has_" + field.name + " bool {");
              lines.push(indent + "    return (" + flags + " & " + mask + ") != 0");
              lines.push(indent + "  }");
              lines.push("");
              lines.push(indent + "  def " + field.name + " " + type + " {");
              lines.push(indent + "    assert(has_" + field.name + ")");
              lines.push(indent + "    return _" + field.name);
              lines.push(indent + "  }");
              lines.push("");
              lines.push(indent + "  def " + field.name + "=(value " + type + ") {");
              lines.push(indent + "    _" + field.name + " = value");
              lines.push(indent + "    " + flags + " |= " + mask);
              lines.push(indent + "  }");
              lines.push("");
            }
            lines.push(indent + "  def encode(bb Kiwi.ByteBuffer) {");
            for (let j = 0; j < definition.fields.length; j++) {
              let field = definition.fields[j];
              if (field.isDeprecated) {
                continue;
              }
              let value = "_" + field.name;
              let code;
              if (field.isArray) {
                value = "value";
              }
              switch (field.type) {
                case "bool": {
                  code = "bb.writeByte(" + value + " as int)";
                  break;
                }
                case "byte": {
                  code = "bb.writeByte(" + value + ")";
                  break;
                }
                case "int": {
                  code = "bb.writeVarInt(" + value + ")";
                  break;
                }
                case "uint": {
                  code = "bb.writeVarUint(" + value + ")";
                  break;
                }
                case "float": {
                  code = "bb.writeVarFloat(" + value + ")";
                  break;
                }
                case "string": {
                  code = "bb.writeString(" + value + ")";
                  break;
                }
                case "int64": {
                  code = "bb.writeVarInt64(" + value + ")";
                  break;
                }
                case "uint64": {
                  code = "bb.writeVarUint64(" + value + ")";
                  break;
                }
                default: {
                  let type = definitions[field.type];
                  if (!type) {
                    error("Invalid type " + quote(field.type) + " for field " + quote(field.name), field.line, field.column);
                  } else if (type.kind === "ENUM") {
                    code = "bb.writeVarUint(" + type.name + ".encode(" + value + "))";
                  } else {
                    code = value + ".encode(bb)";
                  }
                }
              }
              let nestedIndent2 = indent + "    ";
              if (definition.kind === "STRUCT") {
                lines.push(nestedIndent2 + "assert(has_" + field.name + ")");
              } else {
                lines.push(nestedIndent2 + "if has_" + field.name + " {");
                nestedIndent2 += "  ";
              }
              if (definition.kind === "MESSAGE") {
                lines.push(nestedIndent2 + "bb.writeVarUint(" + field.value + ")");
              }
              if (field.isArray) {
                lines.push(nestedIndent2 + "bb.writeVarUint(_" + field.name + ".count)");
                lines.push(nestedIndent2 + "for value in _" + field.name + " {");
                lines.push(nestedIndent2 + "  " + code);
                lines.push(nestedIndent2 + "}");
              } else {
                lines.push(nestedIndent2 + code);
              }
              if (definition.kind !== "STRUCT") {
                lines.push(indent + "    }");
              }
              lines.push("");
            }
            if (definition.kind === "MESSAGE") {
              lines.push(indent + "    bb.writeVarUint(0)");
            } else {
              popTrailingNewline(lines);
            }
            lines.push(indent + "  }");
            lines.push("");
            lines.push(indent + "  def encode Uint8Array {");
            lines.push(indent + "    var bb = Kiwi.ByteBuffer.new");
            lines.push(indent + "    encode(bb)");
            lines.push(indent + "    return bb.toUint8Array");
            lines.push(indent + "  }");
            lines.push(indent + "}");
            lines.push("");
            lines.push(indent + "namespace " + definition.name + " {");
            lines.push(indent + "  def decode(bytes Uint8Array) " + definition.name + " {");
            lines.push(indent + "    return decode(Kiwi.ByteBuffer.new(bytes), null)");
            lines.push(indent + "  }");
            lines.push("");
            lines.push(indent + "  def decode(bytes Uint8Array, schema BinarySchema) " + definition.name + " {");
            lines.push(indent + "    return decode(Kiwi.ByteBuffer.new(bytes), schema)");
            lines.push(indent + "  }");
            lines.push("");
            lines.push(indent + "  def decode(bb Kiwi.ByteBuffer, schema BinarySchema) " + definition.name + " {");
            lines.push(indent + "    var self = new");
            for (let j = 0; j < definition.fields.length; j++) {
              if (definition.fields[j].isArray) {
                lines.push(indent + "    var count = 0");
                break;
              }
            }
            let nestedIndent = indent + "  ";
            if (definition.kind === "MESSAGE") {
              lines.push(indent + "    while true {");
              lines.push(indent + "      var type = bb.readVarUint");
              lines.push(indent + "      switch type {");
              lines.push(indent + "        case 0 {");
              lines.push(indent + "          break");
              lines.push(indent + "        }");
              lines.push("");
              nestedIndent += "      ";
            }
            for (let j = 0; j < definition.fields.length; j++) {
              let field = definition.fields[j];
              let code;
              switch (field.type) {
                case "bool": {
                  code = field.isDeprecated ? "bb.readByte" : "bb.readByte as bool";
                  break;
                }
                case "byte": {
                  code = "bb.readByte";
                  break;
                }
                case "int": {
                  code = "bb.readVarInt";
                  break;
                }
                case "uint": {
                  code = "bb.readVarUint";
                  break;
                }
                case "float": {
                  code = "bb.readVarFloat";
                  break;
                }
                case "string": {
                  code = "bb.readString";
                  break;
                }
                case "int64": {
                  code = "bb.readVarInt64";
                  break;
                }
                case "uint64": {
                  code = "bb.readVarUint64";
                  break;
                }
                default: {
                  let type = definitions[field.type];
                  if (!type) {
                    error("Invalid type " + quote(field.type) + " for field " + quote(field.name), field.line, field.column);
                  } else if (type.kind === "ENUM") {
                    code = type.name + ".decode(bb.readVarUint)";
                  } else {
                    code = type.name + ".decode(bb, schema)";
                  }
                }
              }
              if (definition.kind === "MESSAGE") {
                lines.push(nestedIndent + "case " + field.value + " {");
              }
              if (field.isArray) {
                if (field.isDeprecated) {
                  lines.push(nestedIndent + "  for i in 0..bb.readVarUint {");
                  lines.push(nestedIndent + "    " + code);
                  lines.push(nestedIndent + "  }");
                } else {
                  lines.push(nestedIndent + "  count = bb.readVarUint");
                  lines.push(nestedIndent + "  self." + field.name + " = []");
                  lines.push(nestedIndent + "  for array = self._" + field.name + "; count != 0; count-- {");
                  lines.push(nestedIndent + "    array.append(" + code + ")");
                  lines.push(nestedIndent + "  }");
                }
              } else {
                if (field.isDeprecated) {
                  lines.push(nestedIndent + "  " + code);
                } else {
                  lines.push(nestedIndent + "  self." + field.name + " = " + code);
                }
              }
              if (definition.kind === "MESSAGE") {
                lines.push(nestedIndent + "}");
                lines.push("");
              }
            }
            if (definition.kind === "MESSAGE") {
              lines.push(indent + "        default {");
              lines.push(indent + "          if schema == null { Kiwi.DecodeError.throwInvalidMessage }");
              lines.push(indent + "          else { schema.skip" + definition.name + "Field(bb, type) }");
              lines.push(indent + "        }");
              lines.push(indent + "      }");
              lines.push(indent + "    }");
            }
            lines.push(indent + "    return self");
            lines.push(indent + "  }");
            lines.push(indent + "}");
            lines.push("");
            break;
          }
          default: {
            error("Invalid definition kind " + quote(definition.kind), definition.line, definition.column);
            break;
          }
        }
      }
      if (schema.package !== null) {
        popTrailingNewline(lines);
        lines.push("}");
      }
      lines.push("");
      return lines.join("\n");
    }
    function compileSchemaSkewTypes(schema) {
      var indent = "";
      var lines = [];
      if (schema.package !== null) {
        lines.push("namespace " + schema.package + " {");
        indent += "  ";
      }
      for (var i = 0; i < schema.definitions.length; i++) {
        var definition = schema.definitions[i];
        if (definition.kind === "ENUM") {
          lines.push(indent + "type " + definition.name + " : string {");
          lines.push(indent + "  @alwaysinline");
          lines.push(indent + "  def toString string { return self as string }");
          lines.push(indent + "}");
          if (definition.fields.length > 0) {
            lines.push(indent + "namespace " + definition.name + " {");
            for (var j = 0; j < definition.fields.length; j++) {
              lines.push(indent + "  @alwaysinline");
              lines.push(indent + "  def " + definition.fields[j].name + " " + definition.name + " { return " + JSON.stringify(definition.fields[j].name) + " as " + definition.name + " }");
            }
            lines.push(indent + "}");
          }
          lines.push("");
        }
      }
      for (var i = 0; i < schema.definitions.length; i++) {
        var definition = schema.definitions[i];
        if (definition.kind === "STRUCT" || definition.kind === "MESSAGE") {
          lines.push(indent + "@import");
          lines.push(indent + "class " + definition.name + " {");
          for (var j = 0; j < definition.fields.length; j++) {
            var field = definition.fields[j];
            var type;
            if (field.isDeprecated) {
              continue;
            }
            switch (field.type) {
              case "byte":
              case "uint":
                type = "int";
                break;
              case "float":
                type = "double";
                break;
              case "int64":
              case "uint64":
                type = "BigInt";
                break;
              default:
                type = field.type;
                break;
            }
            if (field.type === "byte" && field.isArray)
              type = "Uint8Array";
            else if (field.isArray)
              type = "List<" + type + ">";
            lines.push(indent + "  var " + field.name + " " + type);
            lines.push(indent + "  @alwaysinline");
            lines.push(indent + "  def has_" + field.name + " bool { return self." + field.name + " != dynamic.void(0) }");
          }
          lines.push(indent + "}");
          lines.push("");
          lines.push(indent + "namespace " + definition.name + " {");
          lines.push(indent + "  @alwaysinline");
          lines.push(indent + "  def new " + definition.name + " { return {} as dynamic }");
          lines.push(indent + "}");
          lines.push("");
        } else if (definition.kind !== "ENUM") {
          error("Invalid definition kind " + quote(definition.kind), definition.line, definition.column);
        }
      }
      lines.push(indent + "@import");
      lines.push(indent + "class Schema {");
      for (var i = 0; i < schema.definitions.length; i++) {
        var definition = schema.definitions[i];
        if (definition.kind === "ENUM") {
          lines.push(indent + "  const " + definition.name + " dynamic");
        } else if (definition.kind === "STRUCT" || definition.kind === "MESSAGE") {
          lines.push(indent + "  def encode" + definition.name + "(message " + definition.name + ") Uint8Array");
          lines.push(indent + "  def decode" + definition.name + "(buffer Uint8Array) " + definition.name);
        }
      }
      lines.push(indent + "}");
      if (schema.package !== null) {
        lines.push("}");
      }
      lines.push("");
      return lines.join("\n");
    }
    function compileSchemaTypeScript(schema) {
      var indent = "";
      var lines = [];
      if (schema.package !== null) {
        lines.push("export namespace " + schema.package + " {");
        indent += "  ";
      }
      for (var i = 0; i < schema.definitions.length; i++) {
        var definition = schema.definitions[i];
        if (definition.kind === "ENUM") {
          lines.push(indent + "export type " + definition.name + " =");
          for (var j = 0; j < definition.fields.length; j++) {
            lines.push(indent + "  " + JSON.stringify(definition.fields[j].name) + (j + 1 < definition.fields.length ? " |" : ";"));
          }
          if (!definition.fields.length) {
            lines.push(indent + "  any;");
          }
          lines.push("");
        }
      }
      for (var i = 0; i < schema.definitions.length; i++) {
        var definition = schema.definitions[i];
        if (definition.kind === "STRUCT" || definition.kind === "MESSAGE") {
          lines.push(indent + "export interface " + definition.name + " {");
          for (var j = 0; j < definition.fields.length; j++) {
            var field = definition.fields[j];
            var type;
            if (field.isDeprecated) {
              continue;
            }
            switch (field.type) {
              case "bool":
                type = "boolean";
                break;
              case "byte":
              case "int":
              case "uint":
              case "float":
                type = "number";
                break;
              case "int64":
              case "uint64":
                type = "bigint";
                break;
              default:
                type = field.type;
                break;
            }
            if (field.type === "byte" && field.isArray)
              type = "Uint8Array";
            else if (field.isArray)
              type += "[]";
            lines.push(indent + "  " + field.name + (definition.kind === "MESSAGE" ? "?" : "") + ": " + type + ";");
          }
          lines.push(indent + "}");
          lines.push("");
        } else if (definition.kind !== "ENUM") {
          error("Invalid definition kind " + quote(definition.kind), definition.line, definition.column);
        }
      }
      lines.push(indent + "export interface Schema {");
      for (var i = 0; i < schema.definitions.length; i++) {
        var definition = schema.definitions[i];
        if (definition.kind === "ENUM") {
          lines.push(indent + "  " + definition.name + ": any;");
        } else if (definition.kind === "STRUCT" || definition.kind === "MESSAGE") {
          lines.push(indent + "  encode" + definition.name + "(message: " + definition.name + "): Uint8Array;");
          lines.push(indent + "  decode" + definition.name + "(buffer: Uint8Array): " + definition.name + ";");
        }
      }
      lines.push(indent + "}");
      if (schema.package !== null) {
        lines.push("}");
      }
      lines.push("");
      return lines.join("\n");
    }
    var types = ["bool", "byte", "int", "uint", "float", "string", "int64", "uint64"];
    var kinds = ["ENUM", "STRUCT", "MESSAGE"];
    function decodeBinarySchema2(buffer) {
      let bb = buffer instanceof ByteBuffer ? buffer : new ByteBuffer(buffer);
      let definitionCount = bb.readVarUint();
      let definitions = [];
      for (let i = 0; i < definitionCount; i++) {
        let definitionName = bb.readString();
        let kind = bb.readByte();
        let fieldCount = bb.readVarUint();
        let fields = [];
        for (let j = 0; j < fieldCount; j++) {
          let fieldName = bb.readString();
          let type = bb.readVarInt();
          let isArray = !!(bb.readByte() & 1);
          let value = bb.readVarUint();
          fields.push({
            name: fieldName,
            line: 0,
            column: 0,
            type: kinds[kind] === "ENUM" ? null : type,
            isArray,
            isDeprecated: false,
            value
          });
        }
        definitions.push({
          name: definitionName,
          line: 0,
          column: 0,
          kind: kinds[kind],
          fields
        });
      }
      for (let i = 0; i < definitionCount; i++) {
        let fields = definitions[i].fields;
        for (let j = 0; j < fields.length; j++) {
          let field = fields[j];
          let type = field.type;
          if (type !== null && type < 0) {
            if (~type >= types.length) {
              throw new Error("Invalid type " + type);
            }
            field.type = types[~type];
          } else {
            if (type !== null && type >= definitions.length) {
              throw new Error("Invalid type " + type);
            }
            field.type = type === null ? null : definitions[type].name;
          }
        }
      }
      return {
        package: null,
        definitions
      };
    }
    function encodeBinarySchema2(schema) {
      let bb = new ByteBuffer();
      let definitions = schema.definitions;
      let definitionIndex = {};
      bb.writeVarUint(definitions.length);
      for (let i = 0; i < definitions.length; i++) {
        definitionIndex[definitions[i].name] = i;
      }
      for (let i = 0; i < definitions.length; i++) {
        let definition = definitions[i];
        bb.writeString(definition.name);
        bb.writeByte(kinds.indexOf(definition.kind));
        bb.writeVarUint(definition.fields.length);
        for (let j = 0; j < definition.fields.length; j++) {
          let field = definition.fields[j];
          let type = types.indexOf(field.type);
          bb.writeString(field.name);
          bb.writeVarInt(type === -1 ? definitionIndex[field.type] : ~type);
          bb.writeByte(field.isArray ? 1 : 0);
          bb.writeVarUint(field.value);
        }
      }
      return bb.toUint8Array();
    }
    var nativeTypes = [
      "bool",
      "byte",
      "float",
      "int",
      "int64",
      "string",
      "uint",
      "uint64"
    ];
    var reservedNames = [
      "ByteBuffer",
      "package"
    ];
    var regex = /((?:-|\b)\d+\b|[=;{}]|\[\]|\[deprecated\]|\b[A-Za-z_][A-Za-z0-9_]*\b|\/\/.*|\s+)/g;
    var identifier = /^[A-Za-z_][A-Za-z0-9_]*$/;
    var whitespace = /^\/\/.*|\s+$/;
    var equals = /^=$/;
    var endOfFile = /^$/;
    var semicolon = /^;$/;
    var integer = /^-?\d+$/;
    var leftBrace = /^\{$/;
    var rightBrace = /^\}$/;
    var arrayToken = /^\[\]$/;
    var enumKeyword = /^enum$/;
    var structKeyword = /^struct$/;
    var messageKeyword = /^message$/;
    var packageKeyword = /^package$/;
    var deprecatedToken = /^\[deprecated\]$/;
    function tokenize(text) {
      let parts = text.split(regex);
      let tokens = [];
      let column = 0;
      let line = 0;
      for (let i = 0; i < parts.length; i++) {
        let part = parts[i];
        if (i & 1) {
          if (!whitespace.test(part)) {
            tokens.push({
              text: part,
              line: line + 1,
              column: column + 1
            });
          }
        } else if (part !== "") {
          error("Syntax error " + quote(part), line + 1, column + 1);
        }
        let lines = part.split("\n");
        if (lines.length > 1)
          column = 0;
        line += lines.length - 1;
        column += lines[lines.length - 1].length;
      }
      tokens.push({
        text: "",
        line,
        column
      });
      return tokens;
    }
    function parse(tokens) {
      function current() {
        return tokens[index];
      }
      function eat(test) {
        if (test.test(current().text)) {
          index++;
          return true;
        }
        return false;
      }
      function expect(test, expected) {
        if (!eat(test)) {
          let token = current();
          error("Expected " + expected + " but found " + quote(token.text), token.line, token.column);
        }
      }
      function unexpectedToken() {
        let token = current();
        error("Unexpected token " + quote(token.text), token.line, token.column);
      }
      let definitions = [];
      let packageText = null;
      let index = 0;
      if (eat(packageKeyword)) {
        packageText = current().text;
        expect(identifier, "identifier");
        expect(semicolon, '";"');
      }
      while (index < tokens.length && !eat(endOfFile)) {
        let fields = [];
        let kind;
        if (eat(enumKeyword))
          kind = "ENUM";
        else if (eat(structKeyword))
          kind = "STRUCT";
        else if (eat(messageKeyword))
          kind = "MESSAGE";
        else
          unexpectedToken();
        let name = current();
        expect(identifier, "identifier");
        expect(leftBrace, '"{"');
        while (!eat(rightBrace)) {
          let type = null;
          let isArray = false;
          let isDeprecated = false;
          if (kind !== "ENUM") {
            type = current().text;
            expect(identifier, "identifier");
            isArray = eat(arrayToken);
          }
          let field = current();
          expect(identifier, "identifier");
          let value = null;
          if (kind !== "STRUCT") {
            expect(equals, '"="');
            value = current();
            expect(integer, "integer");
            if ((+value.text | 0) + "" !== value.text) {
              error("Invalid integer " + quote(value.text), value.line, value.column);
            }
          }
          let deprecated = current();
          if (eat(deprecatedToken)) {
            if (kind !== "MESSAGE") {
              error("Cannot deprecate this field", deprecated.line, deprecated.column);
            }
            isDeprecated = true;
          }
          expect(semicolon, '";"');
          fields.push({
            name: field.text,
            line: field.line,
            column: field.column,
            type,
            isArray,
            isDeprecated,
            value: value !== null ? +value.text | 0 : fields.length + 1
          });
        }
        definitions.push({
          name: name.text,
          line: name.line,
          column: name.column,
          kind,
          fields
        });
      }
      return {
        package: packageText,
        definitions
      };
    }
    function verify(root) {
      let definedTypes = nativeTypes.slice();
      let definitions = {};
      for (let i = 0; i < root.definitions.length; i++) {
        let definition = root.definitions[i];
        if (definedTypes.indexOf(definition.name) !== -1) {
          error("The type " + quote(definition.name) + " is defined twice", definition.line, definition.column);
        }
        if (reservedNames.indexOf(definition.name) !== -1) {
          error("The type name " + quote(definition.name) + " is reserved", definition.line, definition.column);
        }
        definedTypes.push(definition.name);
        definitions[definition.name] = definition;
      }
      for (let i = 0; i < root.definitions.length; i++) {
        let definition = root.definitions[i];
        let fields = definition.fields;
        if (definition.kind === "ENUM" || fields.length === 0) {
          continue;
        }
        for (let j = 0; j < fields.length; j++) {
          let field = fields[j];
          if (definedTypes.indexOf(field.type) === -1) {
            error("The type " + quote(field.type) + " is not defined for field " + quote(field.name), field.line, field.column);
          }
        }
        let values = [];
        for (let j = 0; j < fields.length; j++) {
          let field = fields[j];
          if (values.indexOf(field.value) !== -1) {
            error("The id for field " + quote(field.name) + " is used twice", field.line, field.column);
          }
          if (field.value <= 0) {
            error("The id for field " + quote(field.name) + " must be positive", field.line, field.column);
          }
          if (field.value > fields.length) {
            error("The id for field " + quote(field.name) + " cannot be larger than " + fields.length, field.line, field.column);
          }
          values.push(field.value);
        }
      }
      let state = {};
      let check = (name) => {
        let definition = definitions[name];
        if (definition && definition.kind === "STRUCT") {
          if (state[name] === 1) {
            error("Recursive nesting of " + quote(name) + " is not allowed", definition.line, definition.column);
          }
          if (state[name] !== 2 && definition) {
            state[name] = 1;
            let fields = definition.fields;
            for (let i = 0; i < fields.length; i++) {
              let field = fields[i];
              if (!field.isArray) {
                check(field.type);
              }
            }
            state[name] = 2;
          }
        }
        return true;
      };
      for (let i = 0; i < root.definitions.length; i++) {
        check(root.definitions[i].name);
      }
    }
    function parseSchema(text) {
      let schema = parse(tokenize(text));
      verify(schema);
      return schema;
    }
    function prettyPrintSchema(schema) {
      let definitions = schema.definitions;
      let text = "";
      if (schema.package !== null) {
        text += "package " + schema.package + ";\n";
      }
      for (let i = 0; i < definitions.length; i++) {
        let definition = definitions[i];
        if (i > 0 || schema.package !== null)
          text += "\n";
        text += definition.kind.toLowerCase() + " " + definition.name + " {\n";
        for (let j = 0; j < definition.fields.length; j++) {
          let field = definition.fields[j];
          text += "  ";
          if (definition.kind !== "ENUM") {
            text += field.type;
            if (field.isArray) {
              text += "[]";
            }
            text += " ";
          }
          text += field.name;
          if (definition.kind !== "STRUCT") {
            text += " = " + field.value;
          }
          if (field.isDeprecated) {
            text += " [deprecated]";
          }
          text += ";\n";
        }
        text += "}\n";
      }
      return text;
    }
  }
});

// output/figlens/src/worker.mjs

// output/figlens/src/document.mjs

// output/figlens/node_modules/fflate/esm/index.mjs
var Worker;
var u8 = Uint8Array;
var u16 = Uint16Array;
var i32 = Int32Array;
var fleb = new u8([
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  1,
  1,
  1,
  1,
  2,
  2,
  2,
  2,
  3,
  3,
  3,
  3,
  4,
  4,
  4,
  4,
  5,
  5,
  5,
  5,
  0,
  /* unused */
  0,
  0,
  /* impossible */
  0
]);
var fdeb = new u8([
  0,
  0,
  0,
  0,
  1,
  1,
  2,
  2,
  3,
  3,
  4,
  4,
  5,
  5,
  6,
  6,
  7,
  7,
  8,
  8,
  9,
  9,
  10,
  10,
  11,
  11,
  12,
  12,
  13,
  13,
  /* unused */
  0,
  0
]);
var clim = new u8([16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]);
var freb = function(eb, start) {
  var b = new u16(31);
  for (var i = 0; i < 31; ++i) {
    b[i] = start += 1 << eb[i - 1];
  }
  var r = new i32(b[30]);
  for (var i = 1; i < 30; ++i) {
    for (var j = b[i]; j < b[i + 1]; ++j) {
      r[j] = j - b[i] << 5 | i;
    }
  }
  return { b, r };
};
var _a = freb(fleb, 2);
var fl = _a.b;
var revfl = _a.r;
fl[28] = 258, revfl[258] = 28;
var _b = freb(fdeb, 0);
var fd = _b.b;
var revfd = _b.r;
var rev = new u16(32768);
for (i = 0; i < 32768; ++i) {
  x = (i & 43690) >> 1 | (i & 21845) << 1;
  x = (x & 52428) >> 2 | (x & 13107) << 2;
  x = (x & 61680) >> 4 | (x & 3855) << 4;
  rev[i] = ((x & 65280) >> 8 | (x & 255) << 8) >> 1;
}
var x;
var i;
var hMap = (function(cd, mb, r) {
  var s = cd.length;
  var i = 0;
  var l = new u16(mb);
  for (; i < s; ++i) {
    if (cd[i])
      ++l[cd[i] - 1];
  }
  var le = new u16(mb);
  for (i = 1; i < mb; ++i) {
    le[i] = le[i - 1] + l[i - 1] << 1;
  }
  var co;
  if (r) {
    co = new u16(1 << mb);
    var rvb = 15 - mb;
    for (i = 0; i < s; ++i) {
      if (cd[i]) {
        var sv = i << 4 | cd[i];
        var r_1 = mb - cd[i];
        var v = le[cd[i] - 1]++ << r_1;
        for (var m = v | (1 << r_1) - 1; v <= m; ++v) {
          co[rev[v] >> rvb] = sv;
        }
      }
    }
  } else {
    co = new u16(s);
    for (i = 0; i < s; ++i) {
      if (cd[i]) {
        co[i] = rev[le[cd[i] - 1]++] >> 15 - cd[i];
      }
    }
  }
  return co;
});
var flt = new u8(288);
for (i = 0; i < 144; ++i)
  flt[i] = 8;
var i;
for (i = 144; i < 256; ++i)
  flt[i] = 9;
var i;
for (i = 256; i < 280; ++i)
  flt[i] = 7;
var i;
for (i = 280; i < 288; ++i)
  flt[i] = 8;
var i;
var fdt = new u8(32);
for (i = 0; i < 32; ++i)
  fdt[i] = 5;
var i;
var flrm = /* @__PURE__ */ hMap(flt, 9, 1);
var fdrm = /* @__PURE__ */ hMap(fdt, 5, 1);
var max = function(a) {
  var m = a[0];
  for (var i = 1; i < a.length; ++i) {
    if (a[i] > m)
      m = a[i];
  }
  return m;
};
var bits = function(d, p, m) {
  var o = p / 8 | 0;
  return (d[o] | d[o + 1] << 8) >> (p & 7) & m;
};
var bits16 = function(d, p) {
  var o = p / 8 | 0;
  return (d[o] | d[o + 1] << 8 | d[o + 2] << 16) >> (p & 7);
};
var shft = function(p) {
  return (p + 7) / 8 | 0;
};
var slc = function(v, s, e) {
  if (s == null || s < 0)
    s = 0;
  if (e == null || e > v.length)
    e = v.length;
  return new u8(v.subarray(s, e));
};
var ec = [
  "unexpected EOF",
  "invalid block type",
  "invalid length/literal",
  "invalid distance",
  "stream finished",
  "no stream handler",
  ,
  "no callback",
  "invalid UTF-8 data",
  "extra field too long",
  "date not in range 1980-2099",
  "filename too long",
  "stream finishing",
  "invalid zip data"
  // determined by unknown compression method
];
var err = function(ind, msg, nt) {
  var e = new Error(msg || ec[ind]);
  e.code = ind;
  if (Error.captureStackTrace)
    Error.captureStackTrace(e, err);
  if (!nt)
    throw e;
  return e;
};
var inflt = function(dat, st, buf, dict) {
  var sl = dat.length, dl = dict ? dict.length : 0;
  if (!sl || st.f && !st.l)
    return buf || new u8(0);
  var noBuf = !buf;
  var resize = noBuf || st.i != 2;
  var noSt = st.i;
  if (noBuf)
    buf = new u8(sl * 3);
  var cbuf = function(l2) {
    var bl = buf.length;
    if (l2 > bl) {
      var nbuf = new u8(Math.max(bl * 2, l2));
      nbuf.set(buf);
      buf = nbuf;
    }
  };
  var final = st.f || 0, pos = st.p || 0, bt = st.b || 0, lm = st.l, dm = st.d, lbt = st.m, dbt = st.n;
  var tbts = sl * 8;
  do {
    if (!lm) {
      final = bits(dat, pos, 1);
      var type = bits(dat, pos + 1, 3);
      pos += 3;
      if (!type) {
        var s = shft(pos) + 4, l = dat[s - 4] | dat[s - 3] << 8, t = s + l;
        if (t > sl) {
          if (noSt)
            err(0);
          break;
        }
        if (resize)
          cbuf(bt + l);
        buf.set(dat.subarray(s, t), bt);
        st.b = bt += l, st.p = pos = t * 8, st.f = final;
        continue;
      } else if (type == 1)
        lm = flrm, dm = fdrm, lbt = 9, dbt = 5;
      else if (type == 2) {
        var hLit = bits(dat, pos, 31) + 257, hcLen = bits(dat, pos + 10, 15) + 4;
        var tl = hLit + bits(dat, pos + 5, 31) + 1;
        pos += 14;
        var ldt = new u8(tl);
        var clt = new u8(19);
        for (var i = 0; i < hcLen; ++i) {
          clt[clim[i]] = bits(dat, pos + i * 3, 7);
        }
        pos += hcLen * 3;
        var clb = max(clt), clbmsk = (1 << clb) - 1;
        var clm = hMap(clt, clb, 1);
        for (var i = 0; i < tl; ) {
          var r = clm[bits(dat, pos, clbmsk)];
          pos += r & 15;
          var s = r >> 4;
          if (s < 16) {
            ldt[i++] = s;
          } else {
            var c = 0, n = 0;
            if (s == 16)
              n = 3 + bits(dat, pos, 3), pos += 2, c = ldt[i - 1];
            else if (s == 17)
              n = 3 + bits(dat, pos, 7), pos += 3;
            else if (s == 18)
              n = 11 + bits(dat, pos, 127), pos += 7;
            while (n--)
              ldt[i++] = c;
          }
        }
        var lt = ldt.subarray(0, hLit), dt = ldt.subarray(hLit);
        lbt = max(lt);
        dbt = max(dt);
        lm = hMap(lt, lbt, 1);
        dm = hMap(dt, dbt, 1);
      } else
        err(1);
      if (pos > tbts) {
        if (noSt)
          err(0);
        break;
      }
    }
    if (resize)
      cbuf(bt + 131072);
    var lms = (1 << lbt) - 1, dms = (1 << dbt) - 1;
    var lpos = pos;
    for (; ; lpos = pos) {
      var c = lm[bits16(dat, pos) & lms], sym = c >> 4;
      pos += c & 15;
      if (pos > tbts) {
        if (noSt)
          err(0);
        break;
      }
      if (!c)
        err(2);
      if (sym < 256)
        buf[bt++] = sym;
      else if (sym == 256) {
        lpos = pos, lm = null;
        break;
      } else {
        var add = sym - 254;
        if (sym > 264) {
          var i = sym - 257, b = fleb[i];
          add = bits(dat, pos, (1 << b) - 1) + fl[i];
          pos += b;
        }
        var d = dm[bits16(dat, pos) & dms], dsym = d >> 4;
        if (!d)
          err(3);
        pos += d & 15;
        var dt = fd[dsym];
        if (dsym > 3) {
          var b = fdeb[dsym];
          dt += bits16(dat, pos) & (1 << b) - 1, pos += b;
        }
        if (pos > tbts) {
          if (noSt)
            err(0);
          break;
        }
        if (resize)
          cbuf(bt + 131072);
        var end = bt + add;
        if (bt < dt) {
          var shift = dl - dt, dend = Math.min(dt, end);
          if (shift + bt < 0)
            err(3);
          for (; bt < dend; ++bt)
            buf[bt] = dict[shift + bt];
        }
        for (; bt < end; ++bt)
          buf[bt] = buf[bt - dt];
      }
    }
    st.l = lm, st.p = lpos, st.b = bt, st.f = final;
    if (lm)
      final = 1, st.m = lbt, st.d = dm, st.n = dbt;
  } while (!final);
  return bt != buf.length && noBuf ? slc(buf, 0, bt) : buf.subarray(0, bt);
};
var et = /* @__PURE__ */ new u8(0);
var b2 = function(d, b) {
  return d[b] | d[b + 1] << 8;
};
var b4 = function(d, b) {
  return (d[b] | d[b + 1] << 8 | d[b + 2] << 16 | d[b + 3] << 24) >>> 0;
};
var b8 = function(d, b) {
  return b4(d, b) + b4(d, b + 4) * 4294967296;
};
function inflateSync(data, opts) {
  return inflt(data, { i: 2 }, opts && opts.out, opts && opts.dictionary);
}
var td = typeof TextDecoder != "undefined" && /* @__PURE__ */ new TextDecoder();
var tds = 0;
try {
  td.decode(et, { stream: true });
  tds = 1;
} catch (e) {
}
var dutf8 = function(d) {
  for (var r = "", i = 0; ; ) {
    var c = d[i++];
    var eb = (c > 127) + (c > 223) + (c > 239);
    if (i + eb > d.length)
      return { s: r, r: slc(d, i - 1) };
    if (!eb)
      r += String.fromCharCode(c);
    else if (eb == 3) {
      c = ((c & 15) << 18 | (d[i++] & 63) << 12 | (d[i++] & 63) << 6 | d[i++] & 63) - 65536, r += String.fromCharCode(55296 | c >> 10, 56320 | c & 1023);
    } else if (eb & 1)
      r += String.fromCharCode((c & 31) << 6 | d[i++] & 63);
    else
      r += String.fromCharCode((c & 15) << 12 | (d[i++] & 63) << 6 | d[i++] & 63);
  }
};
function strFromU8(dat, latin1) {
  if (latin1) {
    var r = "";
    for (var i = 0; i < dat.length; i += 16384)
      r += String.fromCharCode.apply(null, dat.subarray(i, i + 16384));
    return r;
  } else if (td) {
    return td.decode(dat);
  } else {
    var _a2 = dutf8(dat), s = _a2.s, r = _a2.r;
    if (r.length)
      err(8);
    return s;
  }
}
var slzh = function(d, b) {
  return b + 30 + b2(d, b + 26) + b2(d, b + 28);
};
var zh = function(d, b, z) {
  var fnl = b2(d, b + 28), fn = strFromU8(d.subarray(b + 46, b + 46 + fnl), !(b2(d, b + 8) & 2048)), es = b + 46 + fnl, bs = b4(d, b + 20);
  var _a2 = z && bs == 4294967295 ? z64e(d, es) : [bs, b4(d, b + 24), b4(d, b + 42)], sc = _a2[0], su = _a2[1], off = _a2[2];
  return [b2(d, b + 10), sc, su, fn, es + b2(d, b + 30) + b2(d, b + 32), off];
};
var z64e = function(d, b) {
  for (; b2(d, b) != 1; b += 4 + b2(d, b + 2))
    ;
  return [b8(d, b + 12), b8(d, b + 4), b8(d, b + 20)];
};
function unzipSync(data, opts) {
  var files = {};
  var e = data.length - 22;
  for (; b4(data, e) != 101010256; --e) {
    if (!e || data.length - e > 65558)
      err(13);
  }
  ;
  var c = b2(data, e + 8);
  if (!c)
    return {};
  var o = b4(data, e + 16);
  var z = o == 4294967295 || c == 65535;
  if (z) {
    var ze = b4(data, e - 12);
    z = b4(data, ze) == 101075792;
    if (z) {
      c = b4(data, ze + 32);
      o = b4(data, ze + 48);
    }
  }
  var fltr = opts && opts.filter;
  for (var i = 0; i < c; ++i) {
    var _a2 = zh(data, o, z), c_2 = _a2[0], sc = _a2[1], su = _a2[2], fn = _a2[3], no = _a2[4], off = _a2[5], b = slzh(data, off);
    o = no;
    if (!fltr || fltr({
      name: fn,
      size: sc,
      originalSize: su,
      compression: c_2
    })) {
      if (!c_2)
        files[fn] = slc(data, b, b + sc);
      else if (c_2 == 8)
        files[fn] = inflateSync(data.subarray(b, b + sc), { out: new u8(su) });
      else
        err(14, "unknown compression type " + c_2);
    }
  }
  return files;
}

// output/figlens/node_modules/openfig-core/dist/index.js
var import_kiwi_schema = __toESM(require_kiwi(), 1);

// output/figlens/node_modules/fzstd/esm/index.mjs
var ab = ArrayBuffer;
var u82 = Uint8Array;
var u162 = Uint16Array;
var i16 = Int16Array;
var i322 = Int32Array;
var slc2 = function(v, s, e) {
  if (u82.prototype.slice)
    return u82.prototype.slice.call(v, s, e);
  if (s == null || s < 0)
    s = 0;
  if (e == null || e > v.length)
    e = v.length;
  var n = new u82(e - s);
  n.set(v.subarray(s, e));
  return n;
};
var fill = function(v, n, s, e) {
  if (u82.prototype.fill)
    return u82.prototype.fill.call(v, n, s, e);
  if (s == null || s < 0)
    s = 0;
  if (e == null || e > v.length)
    e = v.length;
  for (; s < e; ++s)
    v[s] = n;
  return v;
};
var cpw = function(v, t, s, e) {
  if (u82.prototype.copyWithin)
    return u82.prototype.copyWithin.call(v, t, s, e);
  if (s == null || s < 0)
    s = 0;
  if (e == null || e > v.length)
    e = v.length;
  while (s < e) {
    v[t++] = v[s++];
  }
};
var ec2 = [
  "invalid zstd data",
  "window size too large (>2046MB)",
  "invalid block type",
  "FSE accuracy too high",
  "match distance too far back",
  "unexpected EOF"
];
var err2 = function(ind, msg, nt) {
  var e = new Error(msg || ec2[ind]);
  e.code = ind;
  if (Error.captureStackTrace)
    Error.captureStackTrace(e, err2);
  if (!nt)
    throw e;
  return e;
};
var rb = function(d, b, n) {
  var i = 0, o = 0;
  for (; i < n; ++i)
    o |= d[b++] << (i << 3);
  return o;
};
var b42 = function(d, b) {
  return (d[b] | d[b + 1] << 8 | d[b + 2] << 16 | d[b + 3] << 24) >>> 0;
};
var rzfh = function(dat, w) {
  var n3 = dat[0] | dat[1] << 8 | dat[2] << 16;
  if (n3 == 3126568 && dat[3] == 253) {
    var flg = dat[4];
    var ss = flg >> 5 & 1, cc = flg >> 2 & 1, df = flg & 3, fcf = flg >> 6;
    if (flg & 8)
      err2(0);
    var bt = 6 - ss;
    var db = df == 3 ? 4 : df;
    var di = rb(dat, bt, db);
    bt += db;
    var fsb = fcf ? 1 << fcf : ss;
    var fss = rb(dat, bt, fsb) + (fcf == 1 && 256);
    var ws = fss;
    if (!ss) {
      var wb = 1 << 10 + (dat[5] >> 3);
      ws = wb + (wb >> 3) * (dat[5] & 7);
    }
    if (ws > 2145386496)
      err2(1);
    var buf = new u82((w == 1 ? fss || ws : w ? 0 : ws) + 12);
    buf[0] = 1, buf[4] = 4, buf[8] = 8;
    return {
      b: bt + fsb,
      y: 0,
      l: 0,
      d: di,
      w: w && w != 1 ? w : buf.subarray(12),
      e: ws,
      o: new i322(buf.buffer, 0, 3),
      u: fss,
      c: cc,
      m: Math.min(131072, ws)
    };
  } else if ((n3 >> 4 | dat[3] << 20) == 25481893) {
    return b42(dat, 4) + 8;
  }
  err2(0);
};
var msb = function(val) {
  var bits2 = 0;
  for (; 1 << bits2 <= val; ++bits2)
    ;
  return bits2 - 1;
};
var rfse = function(dat, bt, mal) {
  var tpos = (bt << 3) + 4;
  var al = (dat[bt] & 15) + 5;
  if (al > mal)
    err2(3);
  var sz = 1 << al;
  var probs = sz, sym = -1, re = -1, i = -1, ht = sz;
  var buf = new ab(512 + (sz << 2));
  var freq = new i16(buf, 0, 256);
  var dstate = new u162(buf, 0, 256);
  var nstate = new u162(buf, 512, sz);
  var bb1 = 512 + (sz << 1);
  var syms = new u82(buf, bb1, sz);
  var nbits = new u82(buf, bb1 + sz);
  while (sym < 255 && probs > 0) {
    var bits2 = msb(probs + 1);
    var cbt = tpos >> 3;
    var msk = (1 << bits2 + 1) - 1;
    var val = (dat[cbt] | dat[cbt + 1] << 8 | dat[cbt + 2] << 16) >> (tpos & 7) & msk;
    var msk1fb = (1 << bits2) - 1;
    var msv = msk - probs - 1;
    var sval = val & msk1fb;
    if (sval < msv)
      tpos += bits2, val = sval;
    else {
      tpos += bits2 + 1;
      if (val > msk1fb)
        val -= msv;
    }
    freq[++sym] = --val;
    if (val == -1) {
      probs += val;
      syms[--ht] = sym;
    } else
      probs -= val;
    if (!val) {
      do {
        var rbt = tpos >> 3;
        re = (dat[rbt] | dat[rbt + 1] << 8) >> (tpos & 7) & 3;
        tpos += 2;
        sym += re;
      } while (re == 3);
    }
  }
  if (sym > 255 || probs)
    err2(0);
  var sympos = 0;
  var sstep = (sz >> 1) + (sz >> 3) + 3;
  var smask = sz - 1;
  for (var s = 0; s <= sym; ++s) {
    var sf = freq[s];
    if (sf < 1) {
      dstate[s] = -sf;
      continue;
    }
    for (i = 0; i < sf; ++i) {
      syms[sympos] = s;
      do {
        sympos = sympos + sstep & smask;
      } while (sympos >= ht);
    }
  }
  if (sympos)
    err2(0);
  for (i = 0; i < sz; ++i) {
    var ns = dstate[syms[i]]++;
    var nb = nbits[i] = al - msb(ns);
    nstate[i] = (ns << nb) - sz;
  }
  return [tpos + 7 >> 3, {
    b: al,
    s: syms,
    n: nbits,
    t: nstate
  }];
};
var rhu = function(dat, bt) {
  var i = 0, wc = -1;
  var buf = new u82(292), hb = dat[bt];
  var hw = buf.subarray(0, 256);
  var rc = buf.subarray(256, 268);
  var ri = new u162(buf.buffer, 268);
  if (hb < 128) {
    var _a2 = rfse(dat, bt + 1, 6), ebt = _a2[0], fdt2 = _a2[1];
    bt += hb;
    var epos = ebt << 3;
    var lb = dat[bt];
    if (!lb)
      err2(0);
    var st1 = 0, st2 = 0, btr1 = fdt2.b, btr2 = btr1;
    var fpos = (++bt << 3) - 8 + msb(lb);
    for (; ; ) {
      fpos -= btr1;
      if (fpos < epos)
        break;
      var cbt = fpos >> 3;
      st1 += (dat[cbt] | dat[cbt + 1] << 8) >> (fpos & 7) & (1 << btr1) - 1;
      hw[++wc] = fdt2.s[st1];
      fpos -= btr2;
      if (fpos < epos)
        break;
      cbt = fpos >> 3;
      st2 += (dat[cbt] | dat[cbt + 1] << 8) >> (fpos & 7) & (1 << btr2) - 1;
      hw[++wc] = fdt2.s[st2];
      btr1 = fdt2.n[st1];
      st1 = fdt2.t[st1];
      btr2 = fdt2.n[st2];
      st2 = fdt2.t[st2];
    }
    if (++wc > 255)
      err2(0);
  } else {
    wc = hb - 127;
    for (; i < wc; i += 2) {
      var byte = dat[++bt];
      hw[i] = byte >> 4;
      hw[i + 1] = byte & 15;
    }
    ++bt;
  }
  var wes = 0;
  for (i = 0; i < wc; ++i) {
    var wt = hw[i];
    if (wt > 11)
      err2(0);
    wes += wt && 1 << wt - 1;
  }
  var mb = msb(wes) + 1;
  var ts = 1 << mb;
  var rem = ts - wes;
  if (rem & rem - 1)
    err2(0);
  hw[wc++] = msb(rem) + 1;
  for (i = 0; i < wc; ++i) {
    var wt = hw[i];
    ++rc[hw[i] = wt && mb + 1 - wt];
  }
  var hbuf = new u82(ts << 1);
  var syms = hbuf.subarray(0, ts), nb = hbuf.subarray(ts);
  ri[mb] = 0;
  for (i = mb; i > 0; --i) {
    var pv = ri[i];
    fill(nb, i, pv, ri[i - 1] = pv + rc[i] * (1 << mb - i));
  }
  if (ri[0] != ts)
    err2(0);
  for (i = 0; i < wc; ++i) {
    var bits2 = hw[i];
    if (bits2) {
      var code = ri[bits2];
      fill(syms, i, code, ri[bits2] = code + (1 << mb - bits2));
    }
  }
  return [bt, {
    n: nb,
    b: mb,
    s: syms
  }];
};
var dllt = rfse(/* @__PURE__ */ new u82([
  81,
  16,
  99,
  140,
  49,
  198,
  24,
  99,
  12,
  33,
  196,
  24,
  99,
  102,
  102,
  134,
  70,
  146,
  4
]), 0, 6)[1];
var dmlt = rfse(/* @__PURE__ */ new u82([
  33,
  20,
  196,
  24,
  99,
  140,
  33,
  132,
  16,
  66,
  8,
  33,
  132,
  16,
  66,
  8,
  33,
  68,
  68,
  68,
  68,
  68,
  68,
  68,
  68,
  36,
  9
]), 0, 6)[1];
var doct = rfse(/* @__PURE__ */ new u82([
  32,
  132,
  16,
  66,
  102,
  70,
  68,
  68,
  68,
  68,
  36,
  73,
  2
]), 0, 5)[1];
var b2bl = function(b, s) {
  var len = b.length, bl = new i322(len);
  for (var i = 0; i < len; ++i) {
    bl[i] = s;
    s += 1 << b[i];
  }
  return bl;
};
var llb = /* @__PURE__ */ new u82((/* @__PURE__ */ new i322([
  0,
  0,
  0,
  0,
  16843009,
  50528770,
  134678020,
  202050057,
  269422093
])).buffer, 0, 36);
var llbl = /* @__PURE__ */ b2bl(llb, 0);
var mlb = /* @__PURE__ */ new u82((/* @__PURE__ */ new i322([
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  16843009,
  50528770,
  117769220,
  185207048,
  252579084,
  16
])).buffer, 0, 53);
var mlbl = /* @__PURE__ */ b2bl(mlb, 3);
var dhu = function(dat, out, hu) {
  var len = dat.length, ss = out.length, lb = dat[len - 1], msk = (1 << hu.b) - 1, eb = -hu.b;
  if (!lb)
    err2(0);
  var st = 0, btr = hu.b, pos = (len << 3) - 8 + msb(lb) - btr, i = -1;
  for (; pos > eb && i < ss; ) {
    var cbt = pos >> 3;
    var val = (dat[cbt] | dat[cbt + 1] << 8 | dat[cbt + 2] << 16) >> (pos & 7);
    st = (st << btr | val) & msk;
    out[++i] = hu.s[st];
    pos -= btr = hu.n[st];
  }
  if (pos != eb || i + 1 != ss)
    err2(0);
};
var dhu4 = function(dat, out, hu) {
  var bt = 6;
  var ss = out.length, sz1 = ss + 3 >> 2, sz2 = sz1 << 1, sz3 = sz1 + sz2;
  dhu(dat.subarray(bt, bt += dat[0] | dat[1] << 8), out.subarray(0, sz1), hu);
  dhu(dat.subarray(bt, bt += dat[2] | dat[3] << 8), out.subarray(sz1, sz2), hu);
  dhu(dat.subarray(bt, bt += dat[4] | dat[5] << 8), out.subarray(sz2, sz3), hu);
  dhu(dat.subarray(bt), out.subarray(sz3), hu);
};
var rzb = function(dat, st, out) {
  var _a2;
  var bt = st.b;
  var b0 = dat[bt], btype = b0 >> 1 & 3;
  st.l = b0 & 1;
  var sz = b0 >> 3 | dat[bt + 1] << 5 | dat[bt + 2] << 13;
  var ebt = (bt += 3) + sz;
  if (btype == 1) {
    if (bt >= dat.length)
      return;
    st.b = bt + 1;
    if (out) {
      fill(out, dat[bt], st.y, st.y += sz);
      return out;
    }
    return fill(new u82(sz), dat[bt]);
  }
  if (ebt > dat.length)
    return;
  if (btype == 0) {
    st.b = ebt;
    if (out) {
      out.set(dat.subarray(bt, ebt), st.y);
      st.y += sz;
      return out;
    }
    return slc2(dat, bt, ebt);
  }
  if (btype == 2) {
    var b3 = dat[bt], lbt = b3 & 3, sf = b3 >> 2 & 3;
    var lss = b3 >> 4, lcs = 0, s4 = 0;
    if (lbt < 2) {
      if (sf & 1)
        lss |= dat[++bt] << 4 | (sf & 2 && dat[++bt] << 12);
      else
        lss = b3 >> 3;
    } else {
      s4 = sf;
      if (sf < 2)
        lss |= (dat[++bt] & 63) << 4, lcs = dat[bt] >> 6 | dat[++bt] << 2;
      else if (sf == 2)
        lss |= dat[++bt] << 4 | (dat[++bt] & 3) << 12, lcs = dat[bt] >> 2 | dat[++bt] << 6;
      else
        lss |= dat[++bt] << 4 | (dat[++bt] & 63) << 12, lcs = dat[bt] >> 6 | dat[++bt] << 2 | dat[++bt] << 10;
    }
    ++bt;
    var buf = out ? out.subarray(st.y, st.y + st.m) : new u82(st.m);
    var spl = buf.length - lss;
    if (lbt == 0)
      buf.set(dat.subarray(bt, bt += lss), spl);
    else if (lbt == 1)
      fill(buf, dat[bt++], spl);
    else {
      var hu = st.h;
      if (lbt == 2) {
        var hud = rhu(dat, bt);
        lcs += bt - (bt = hud[0]);
        st.h = hu = hud[1];
      } else if (!hu)
        err2(0);
      (s4 ? dhu4 : dhu)(dat.subarray(bt, bt += lcs), buf.subarray(spl), hu);
    }
    var ns = dat[bt++];
    if (ns) {
      if (ns == 255)
        ns = (dat[bt++] | dat[bt++] << 8) + 32512;
      else if (ns > 127)
        ns = ns - 128 << 8 | dat[bt++];
      var scm = dat[bt++];
      if (scm & 3)
        err2(0);
      var dts = [dmlt, doct, dllt];
      for (var i = 2; i > -1; --i) {
        var md = scm >> (i << 1) + 2 & 3;
        if (md == 1) {
          var rbuf = new u82([0, 0, dat[bt++]]);
          dts[i] = {
            s: rbuf.subarray(2, 3),
            n: rbuf.subarray(0, 1),
            t: new u162(rbuf.buffer, 0, 1),
            b: 0
          };
        } else if (md == 2) {
          _a2 = rfse(dat, bt, 9 - (i & 1)), bt = _a2[0], dts[i] = _a2[1];
        } else if (md == 3) {
          if (!st.t)
            err2(0);
          dts[i] = st.t[i];
        }
      }
      var _b2 = st.t = dts, mlt = _b2[0], oct = _b2[1], llt = _b2[2];
      var lb = dat[ebt - 1];
      if (!lb)
        err2(0);
      var spos = (ebt << 3) - 8 + msb(lb) - llt.b, cbt = spos >> 3, oubt = 0;
      var lst = (dat[cbt] | dat[cbt + 1] << 8) >> (spos & 7) & (1 << llt.b) - 1;
      cbt = (spos -= oct.b) >> 3;
      var ost = (dat[cbt] | dat[cbt + 1] << 8) >> (spos & 7) & (1 << oct.b) - 1;
      cbt = (spos -= mlt.b) >> 3;
      var mst = (dat[cbt] | dat[cbt + 1] << 8) >> (spos & 7) & (1 << mlt.b) - 1;
      for (++ns; --ns; ) {
        var llc = llt.s[lst];
        var lbtr = llt.n[lst];
        var mlc = mlt.s[mst];
        var mbtr = mlt.n[mst];
        var ofc = oct.s[ost];
        var obtr = oct.n[ost];
        cbt = (spos -= ofc) >> 3;
        var ofp = 1 << ofc;
        var off = ofp + ((dat[cbt] | dat[cbt + 1] << 8 | dat[cbt + 2] << 16 | dat[cbt + 3] << 24) >>> (spos & 7) & ofp - 1);
        cbt = (spos -= mlb[mlc]) >> 3;
        var ml = mlbl[mlc] + ((dat[cbt] | dat[cbt + 1] << 8 | dat[cbt + 2] << 16) >> (spos & 7) & (1 << mlb[mlc]) - 1);
        cbt = (spos -= llb[llc]) >> 3;
        var ll = llbl[llc] + ((dat[cbt] | dat[cbt + 1] << 8 | dat[cbt + 2] << 16) >> (spos & 7) & (1 << llb[llc]) - 1);
        cbt = (spos -= lbtr) >> 3;
        lst = llt.t[lst] + ((dat[cbt] | dat[cbt + 1] << 8) >> (spos & 7) & (1 << lbtr) - 1);
        cbt = (spos -= mbtr) >> 3;
        mst = mlt.t[mst] + ((dat[cbt] | dat[cbt + 1] << 8) >> (spos & 7) & (1 << mbtr) - 1);
        cbt = (spos -= obtr) >> 3;
        ost = oct.t[ost] + ((dat[cbt] | dat[cbt + 1] << 8) >> (spos & 7) & (1 << obtr) - 1);
        if (off > 3) {
          st.o[2] = st.o[1];
          st.o[1] = st.o[0];
          st.o[0] = off -= 3;
        } else {
          var idx = off - (ll != 0);
          if (idx) {
            off = idx == 3 ? st.o[0] - 1 : st.o[idx];
            if (idx > 1)
              st.o[2] = st.o[1];
            st.o[1] = st.o[0];
            st.o[0] = off;
          } else
            off = st.o[0];
        }
        for (var i = 0; i < ll; ++i) {
          buf[oubt + i] = buf[spl + i];
        }
        oubt += ll, spl += ll;
        var stin = oubt - off;
        if (stin < 0) {
          var len = -stin;
          var bs = st.e + stin;
          if (len > ml)
            len = ml;
          for (var i = 0; i < len; ++i) {
            buf[oubt + i] = st.w[bs + i];
          }
          oubt += len, ml -= len, stin = 0;
        }
        for (var i = 0; i < ml; ++i) {
          buf[oubt + i] = buf[stin + i];
        }
        oubt += ml;
      }
      if (oubt != spl) {
        while (spl < buf.length) {
          buf[oubt++] = buf[spl++];
        }
      } else
        oubt = buf.length;
      if (out)
        st.y += oubt;
      else
        buf = slc2(buf, 0, oubt);
    } else if (out) {
      st.y += lss;
      if (spl) {
        for (var i = 0; i < lss; ++i) {
          buf[i] = buf[spl + i];
        }
      }
    } else if (spl)
      buf = slc2(buf, spl);
    st.b = ebt;
    return buf;
  }
  err2(2);
};
var cct = function(bufs, ol) {
  if (bufs.length == 1)
    return bufs[0];
  var buf = new u82(ol);
  for (var i = 0, b = 0; i < bufs.length; ++i) {
    var chk = bufs[i];
    buf.set(chk, b);
    b += chk.length;
  }
  return buf;
};
function decompress(dat, buf) {
  var bufs = [], nb = +!buf;
  var bt = 0, ol = 0;
  for (; dat.length; ) {
    var st = rzfh(dat, nb || buf);
    if (typeof st == "object") {
      if (nb) {
        buf = null;
        if (st.w.length == st.u) {
          bufs.push(buf = st.w);
          ol += st.u;
        }
      } else {
        bufs.push(buf);
        st.e = 0;
      }
      for (; !st.l; ) {
        var blk = rzb(dat, st, buf);
        if (!blk)
          err2(5);
        if (buf)
          st.e = st.y;
        else {
          bufs.push(blk);
          ol += blk.length;
          cpw(st.w, 0, blk.length);
          st.w.set(blk, st.w.length - blk.length);
        }
      }
      bt = st.b + st.c * 4;
    } else
      bt = st;
    dat = dat.subarray(bt);
  }
  return cct(bufs, ol);
}

// output/figlens/node_modules/openfig-core/dist/index.js
var import_kiwi_schema2 = __toESM(require_kiwi(), 1);
function nodeId(node) {
  if (!node?.guid) return null;
  return `${node.guid.sessionID}:${node.guid.localID}`;
}
function parseFigBinary(data) {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const prelude = String.fromCharCode(...data.subarray(0, 8));
  if (!prelude.startsWith("fig-")) {
    throw new Error(`Unknown prelude: ${prelude}`);
  }
  const version = view.getUint32(8, true);
  const chunks = [];
  let off = 12;
  while (off < data.byteLength) {
    if (off + 4 > data.byteLength) {
      throw new Error(
        `Truncated .fig binary: ${data.byteLength - off} byte(s) left at offset ${off}, expected a 4-byte chunk length`
      );
    }
    const len = view.getUint32(off, true);
    off += 4;
    if (off + len > data.byteLength) {
      throw new Error(
        `Truncated .fig binary: chunk ${chunks.length} declares ${len} bytes at offset ${off} but only ${data.byteLength - off} remain`
      );
    }
    chunks.push(data.subarray(off, off + len));
    off += len;
  }
  if (chunks.length < 2) {
    throw new Error("Expected at least 2 chunks in .fig binary");
  }
  const schemaData = inflateSync(chunks[0]);
  const schema = (0, import_kiwi_schema.decodeBinarySchema)(schemaData);
  const compiled = (0, import_kiwi_schema.compileSchema)(schema);
  let msgData;
  const c1 = chunks[1];
  if (c1[0] === 40 && c1[1] === 181 && c1[2] === 47 && c1[3] === 253) {
    msgData = decompress(c1);
  } else {
    msgData = inflateSync(c1);
  }
  const message = compiled.decodeMessage(msgData);
  const nodes = message.nodeChanges;
  const nodeMap = /* @__PURE__ */ new Map();
  const childrenMap = /* @__PURE__ */ new Map();
  for (const node of nodes) {
    const id = nodeId(node);
    if (id) nodeMap.set(id, node);
  }
  for (const node of nodes) {
    if (!node.parentIndex?.guid) continue;
    const pid = `${node.parentIndex.guid.sessionID}:${node.parentIndex.guid.localID}`;
    if (!childrenMap.has(pid)) childrenMap.set(pid, []);
    childrenMap.get(pid).push(node);
  }
  return {
    header: { prelude: prelude.trim(), version },
    nodes,
    nodeMap,
    childrenMap,
    schema,
    compiledSchema: compiled,
    rawChunks: chunks,
    message,
    images: /* @__PURE__ */ new Map()
  };
}
function parseFig(data) {
  if (data[0] !== 80 || data[1] !== 75) {
    throw new Error("Not a valid .fig file (missing ZIP header)");
  }
  const unzipped = unzipSync(data);
  const canvasKey = Object.keys(unzipped).find((k) => k.endsWith("canvas.fig"));
  if (!canvasKey) {
    throw new Error("No canvas.fig found in .fig archive");
  }
  const doc = parseFigBinary(unzipped[canvasKey]);
  const metaKey = Object.keys(unzipped).find((k) => k.endsWith("meta.json"));
  if (metaKey) {
    try {
      doc.meta = JSON.parse(new TextDecoder().decode(unzipped[metaKey]));
    } catch {
    }
  }
  const thumbKey = Object.keys(unzipped).find((k) => k.endsWith("thumbnail.png"));
  if (thumbKey) {
    doc.thumbnail = unzipped[thumbKey];
  }
  for (const key of Object.keys(unzipped)) {
    if (key.includes("images/") && key !== "images/") {
      const filename = key.split("/").pop();
      doc.images.set(filename, unzipped[key]);
    }
  }
  return doc;
}
var CMD_CLOSE = 0;
var CMD_MOVE_TO = 1;
var CMD_LINE_TO = 2;
var CMD_CUBIC_TO = 4;
function roundPathNumber(n, decimals = 4) {
  const factor = 10 ** decimals;
  return Math.round(n * factor) / factor;
}
function getBlobBytes(doc, blobIndex) {
  if (blobIndex == null || blobIndex < 0) return null;
  const blob = doc.message?.blobs?.[blobIndex];
  if (!blob) return null;
  if (blob instanceof Uint8Array) return blob;
  if (blob.bytes instanceof Uint8Array) return blob.bytes;
  if (Array.isArray(blob.bytes)) return Uint8Array.from(blob.bytes);
  if (blob.bytes && typeof blob.bytes === "object") {
    const values = Object.values(blob.bytes);
    if (values.every((value) => typeof value === "number")) {
      return Uint8Array.from(values);
    }
  }
  return null;
}
function geometryBlobToSVGPath(blob) {
  if (!blob.length) return "";
  const view = new DataView(blob.buffer, blob.byteOffset, blob.byteLength);
  let offset = 0;
  const parts = [];
  const canRead = (byteLength) => offset + byteLength <= blob.length;
  while (offset < blob.length) {
    const cmd = blob[offset++];
    switch (cmd) {
      case CMD_CLOSE:
        parts.push("Z");
        break;
      case CMD_MOVE_TO: {
        if (!canRead(8)) return parts.join("");
        const x = roundPathNumber(view.getFloat32(offset, true));
        const y = roundPathNumber(view.getFloat32(offset + 4, true));
        offset += 8;
        parts.push(`M${x} ${y}`);
        break;
      }
      case CMD_LINE_TO: {
        if (!canRead(8)) return parts.join("");
        const x = roundPathNumber(view.getFloat32(offset, true));
        const y = roundPathNumber(view.getFloat32(offset + 4, true));
        offset += 8;
        parts.push(`L${x} ${y}`);
        break;
      }
      case CMD_CUBIC_TO: {
        if (!canRead(24)) return parts.join("");
        const x1 = roundPathNumber(view.getFloat32(offset, true));
        const y1 = roundPathNumber(view.getFloat32(offset + 4, true));
        const x2 = roundPathNumber(view.getFloat32(offset + 8, true));
        const y2 = roundPathNumber(view.getFloat32(offset + 12, true));
        const x = roundPathNumber(view.getFloat32(offset + 16, true));
        const y = roundPathNumber(view.getFloat32(offset + 20, true));
        offset += 24;
        parts.push(`C${x1} ${y1} ${x2} ${y2} ${x} ${y}`);
        break;
      }
      default:
        return parts.join("");
    }
  }
  return parts.join("");
}

// output/figlens/src/document.mjs

// output/figlens/dist/svg-builder.mjs
var __create2 = Object.create;
var __defProp2 = Object.defineProperty;
var __getOwnPropDesc2 = Object.getOwnPropertyDescriptor;
var __getOwnPropNames2 = Object.getOwnPropertyNames;
var __getProtoOf2 = Object.getPrototypeOf;
var __hasOwnProp2 = Object.prototype.hasOwnProperty;
var __commonJS2 = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames2(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __copyProps2 = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames2(from))
      if (!__hasOwnProp2.call(to, key) && key !== except)
        __defProp2(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc2(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM2 = (mod, isNodeMode, target) => (target = mod != null ? __create2(__getProtoOf2(mod)) : {}, __copyProps2(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp2(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var require_kiwi2 = __commonJS2({
  "output/figlens/node_modules/kiwi-schema/kiwi.js"(exports2, module2) {
    "use strict";
    var __defProp22 = Object.defineProperty;
    var __getOwnPropDesc22 = Object.getOwnPropertyDescriptor;
    var __getOwnPropNames22 = Object.getOwnPropertyNames;
    var __hasOwnProp22 = Object.prototype.hasOwnProperty;
    var __export = (target, all) => {
      for (var name in all)
        __defProp22(target, name, { get: all[name], enumerable: true });
    };
    var __copyProps22 = (to, from, except, desc) => {
      if (from && typeof from === "object" || typeof from === "function") {
        for (let key of __getOwnPropNames22(from))
          if (!__hasOwnProp22.call(to, key) && key !== except)
            __defProp22(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc22(from, key)) || desc.enumerable });
      }
      return to;
    };
    var __toCommonJS = (mod) => __copyProps22(__defProp22({}, "__esModule", { value: true }), mod);
    var kiwi_exports = {};
    __export(kiwi_exports, {
      ByteBuffer: () => ByteBuffer,
      compileSchema: () => compileSchema2,
      compileSchemaCPP: () => compileSchemaCPP,
      compileSchemaCallbackCPP: () => compileSchemaCallbackCPP,
      compileSchemaJS: () => compileSchemaJS,
      compileSchemaSkew: () => compileSchemaSkew,
      compileSchemaSkewTypes: () => compileSchemaSkewTypes,
      compileSchemaTypeScript: () => compileSchemaTypeScript,
      decodeBinarySchema: () => decodeBinarySchema2,
      encodeBinarySchema: () => encodeBinarySchema2,
      parseSchema: () => parseSchema,
      prettyPrintSchema: () => prettyPrintSchema
    });
    module2.exports = __toCommonJS(kiwi_exports);
    var int32 = new Int32Array(1);
    var float32 = new Float32Array(int32.buffer);
    var ByteBuffer = class {
      constructor(data) {
        if (data && !(data instanceof Uint8Array)) {
          throw new Error("Must initialize a ByteBuffer with a Uint8Array");
        }
        this._data = data || new Uint8Array(256);
        this._index = 0;
        this.length = data ? data.length : 0;
      }
      toUint8Array() {
        return this._data.subarray(0, this.length);
      }
      readByte() {
        if (this._index + 1 > this._data.length) {
          throw new Error("Index out of bounds");
        }
        return this._data[this._index++];
      }
      readByteArray() {
        let length = this.readVarUint();
        let start = this._index;
        let end = start + length;
        if (end > this._data.length) {
          throw new Error("Read array out of bounds");
        }
        this._index = end;
        let result = new Uint8Array(length);
        result.set(this._data.subarray(start, end));
        return result;
      }
      readVarFloat() {
        let index = this._index;
        let data = this._data;
        let length = data.length;
        if (index + 1 > length) {
          throw new Error("Index out of bounds");
        }
        let first = data[index];
        if (first === 0) {
          this._index = index + 1;
          return 0;
        }
        if (index + 4 > length) {
          throw new Error("Index out of bounds");
        }
        let bits2 = first | data[index + 1] << 8 | data[index + 2] << 16 | data[index + 3] << 24;
        this._index = index + 4;
        bits2 = bits2 << 23 | bits2 >>> 9;
        int32[0] = bits2;
        return float32[0];
      }
      readVarUint() {
        let value = 0;
        let shift = 0;
        do {
          var byte = this.readByte();
          value |= (byte & 127) << shift;
          shift += 7;
        } while (byte & 128 && shift < 35);
        return value >>> 0;
      }
      readVarInt() {
        let value = this.readVarUint() | 0;
        return value & 1 ? ~(value >>> 1) : value >>> 1;
      }
      readVarUint64() {
        let value = BigInt(0);
        let shift = BigInt(0);
        let seven = BigInt(7);
        let byte;
        while ((byte = this.readByte()) & 128 && shift < 56) {
          value |= BigInt(byte & 127) << shift;
          shift += seven;
        }
        value |= BigInt(byte) << shift;
        return value;
      }
      readVarInt64() {
        let value = this.readVarUint64();
        let one = BigInt(1);
        let sign = value & one;
        value >>= one;
        return sign ? ~value : value;
      }
      readString() {
        let result = "";
        while (true) {
          let codePoint;
          let a = this.readByte();
          if (a < 192) {
            codePoint = a;
          } else {
            let b = this.readByte();
            if (a < 224) {
              codePoint = (a & 31) << 6 | b & 63;
            } else {
              let c = this.readByte();
              if (a < 240) {
                codePoint = (a & 15) << 12 | (b & 63) << 6 | c & 63;
              } else {
                let d = this.readByte();
                codePoint = (a & 7) << 18 | (b & 63) << 12 | (c & 63) << 6 | d & 63;
              }
            }
          }
          if (codePoint === 0) {
            break;
          }
          if (codePoint < 65536) {
            result += String.fromCharCode(codePoint);
          } else {
            codePoint -= 65536;
            result += String.fromCharCode((codePoint >> 10) + 55296, (codePoint & (1 << 10) - 1) + 56320);
          }
        }
        return result;
      }
      _growBy(amount) {
        if (this.length + amount > this._data.length) {
          let data = new Uint8Array(this.length + amount << 1);
          data.set(this._data);
          this._data = data;
        }
        this.length += amount;
      }
      writeByte(value) {
        let index = this.length;
        this._growBy(1);
        this._data[index] = value;
      }
      writeByteArray(value) {
        this.writeVarUint(value.length);
        let index = this.length;
        this._growBy(value.length);
        this._data.set(value, index);
      }
      writeVarFloat(value) {
        let index = this.length;
        float32[0] = value;
        let bits2 = int32[0];
        bits2 = bits2 >>> 23 | bits2 << 9;
        if ((bits2 & 255) === 0) {
          this.writeByte(0);
          return;
        }
        this._growBy(4);
        let data = this._data;
        data[index] = bits2;
        data[index + 1] = bits2 >> 8;
        data[index + 2] = bits2 >> 16;
        data[index + 3] = bits2 >> 24;
      }
      writeVarUint(value) {
        if (value < 0 || value > 4294967295)
          throw new Error("Outside uint range: " + value);
        do {
          let byte = value & 127;
          value >>>= 7;
          this.writeByte(value ? byte | 128 : byte);
        } while (value);
      }
      writeVarInt(value) {
        if (value < -2147483648 || value > 2147483647)
          throw new Error("Outside int range: " + value);
        this.writeVarUint((value << 1 ^ value >> 31) >>> 0);
      }
      writeVarUint64(value) {
        if (typeof value === "string")
          value = BigInt(value);
        else if (typeof value !== "bigint")
          throw new Error("Expected bigint but got " + typeof value + ": " + value);
        if (value < 0 || value > BigInt("0xFFFFFFFFFFFFFFFF"))
          throw new Error("Outside uint64 range: " + value);
        let mask = BigInt(127);
        let seven = BigInt(7);
        for (let i = 0; value > mask && i < 8; i++) {
          this.writeByte(Number(value & mask) | 128);
          value >>= seven;
        }
        this.writeByte(Number(value));
      }
      writeVarInt64(value) {
        if (typeof value === "string")
          value = BigInt(value);
        else if (typeof value !== "bigint")
          throw new Error("Expected bigint but got " + typeof value + ": " + value);
        if (value < -BigInt("0x8000000000000000") || value > BigInt("0x7FFFFFFFFFFFFFFF"))
          throw new Error("Outside int64 range: " + value);
        let one = BigInt(1);
        this.writeVarUint64(value < 0 ? ~(value << one) : value << one);
      }
      writeString(value) {
        let codePoint;
        for (let i = 0; i < value.length; i++) {
          let a = value.charCodeAt(i);
          if (i + 1 === value.length || a < 55296 || a >= 56320) {
            codePoint = a;
          } else {
            let b = value.charCodeAt(++i);
            codePoint = (a << 10) + b + (65536 - (55296 << 10) - 56320);
          }
          if (codePoint === 0) {
            throw new Error("Cannot encode a string containing the null character");
          }
          if (codePoint < 128) {
            this.writeByte(codePoint);
          } else {
            if (codePoint < 2048) {
              this.writeByte(codePoint >> 6 & 31 | 192);
            } else {
              if (codePoint < 65536) {
                this.writeByte(codePoint >> 12 & 15 | 224);
              } else {
                this.writeByte(codePoint >> 18 & 7 | 240);
                this.writeByte(codePoint >> 12 & 63 | 128);
              }
              this.writeByte(codePoint >> 6 & 63 | 128);
            }
            this.writeByte(codePoint & 63 | 128);
          }
        }
        this.writeByte(0);
      }
    };
    function quote(text) {
      return JSON.stringify(text);
    }
    function error(text, line, column) {
      var error2 = new Error(text);
      error2.line = line;
      error2.column = column;
      throw error2;
    }
    function compileDecode(definition, definitions) {
      let lines = [];
      let indent = "  ";
      lines.push("function (bb) {");
      lines.push("  var result = {};");
      lines.push("  if (!(bb instanceof this.ByteBuffer)) {");
      lines.push("    bb = new this.ByteBuffer(bb);");
      lines.push("  }");
      lines.push("");
      if (definition.kind === "MESSAGE") {
        lines.push("  while (true) {");
        lines.push("    switch (bb.readVarUint()) {");
        lines.push("      case 0:");
        lines.push("        return result;");
        lines.push("");
        indent = "        ";
      }
      for (let i = 0; i < definition.fields.length; i++) {
        let field = definition.fields[i];
        let code;
        switch (field.type) {
          case "bool": {
            code = "!!bb.readByte()";
            break;
          }
          case "byte": {
            code = "bb.readByte()";
            break;
          }
          case "int": {
            code = "bb.readVarInt()";
            break;
          }
          case "uint": {
            code = "bb.readVarUint()";
            break;
          }
          case "float": {
            code = "bb.readVarFloat()";
            break;
          }
          case "string": {
            code = "bb.readString()";
            break;
          }
          case "int64": {
            code = "bb.readVarInt64()";
            break;
          }
          case "uint64": {
            code = "bb.readVarUint64()";
            break;
          }
          default: {
            let type = definitions[field.type];
            if (!type) {
              error("Invalid type " + quote(field.type) + " for field " + quote(field.name), field.line, field.column);
            } else if (type.kind === "ENUM") {
              code = "this[" + quote(type.name) + "][bb.readVarUint()]";
            } else {
              code = "this[" + quote("decode" + type.name) + "](bb)";
            }
          }
        }
        if (definition.kind === "MESSAGE") {
          lines.push("      case " + field.value + ":");
        }
        if (field.isArray) {
          if (field.isDeprecated) {
            if (field.type === "byte") {
              lines.push(indent + "bb.readByteArray();");
            } else {
              lines.push(indent + "var length = bb.readVarUint();");
              lines.push(indent + "while (length-- > 0) " + code + ";");
            }
          } else {
            if (field.type === "byte") {
              lines.push(indent + "result[" + quote(field.name) + "] = bb.readByteArray();");
            } else {
              lines.push(indent + "var length = bb.readVarUint();");
              lines.push(indent + "var values = result[" + quote(field.name) + "] = Array(length);");
              lines.push(indent + "for (var i = 0; i < length; i++) values[i] = " + code + ";");
            }
          }
        } else {
          if (field.isDeprecated) {
            lines.push(indent + code + ";");
          } else {
            lines.push(indent + "result[" + quote(field.name) + "] = " + code + ";");
          }
        }
        if (definition.kind === "MESSAGE") {
          lines.push("        break;");
          lines.push("");
        }
      }
      if (definition.kind === "MESSAGE") {
        lines.push("      default:");
        lines.push('        throw new Error("Attempted to parse invalid message");');
        lines.push("    }");
        lines.push("  }");
      } else {
        lines.push("  return result;");
      }
      lines.push("}");
      return lines.join("\n");
    }
    function compileEncode(definition, definitions) {
      let lines = [];
      lines.push("function (message, bb) {");
      lines.push("  var isTopLevel = !bb;");
      lines.push("  if (isTopLevel) bb = new this.ByteBuffer();");
      for (let j = 0; j < definition.fields.length; j++) {
        let field = definition.fields[j];
        let code;
        if (field.isDeprecated) {
          continue;
        }
        switch (field.type) {
          case "bool": {
            code = "bb.writeByte(value);";
            break;
          }
          case "byte": {
            code = "bb.writeByte(value);";
            break;
          }
          case "int": {
            code = "bb.writeVarInt(value);";
            break;
          }
          case "uint": {
            code = "bb.writeVarUint(value);";
            break;
          }
          case "float": {
            code = "bb.writeVarFloat(value);";
            break;
          }
          case "string": {
            code = "bb.writeString(value);";
            break;
          }
          case "int64": {
            code = "bb.writeVarInt64(value);";
            break;
          }
          case "uint64": {
            code = "bb.writeVarUint64(value);";
            break;
          }
          default: {
            let type = definitions[field.type];
            if (!type) {
              throw new Error("Invalid type " + quote(field.type) + " for field " + quote(field.name));
            } else if (type.kind === "ENUM") {
              code = "var encoded = this[" + quote(type.name) + '][value]; if (encoded === void 0) throw new Error("Invalid value " + JSON.stringify(value) + ' + quote(" for enum " + quote(type.name)) + "); bb.writeVarUint(encoded);";
            } else {
              code = "this[" + quote("encode" + type.name) + "](value, bb);";
            }
          }
        }
        lines.push("");
        lines.push("  var value = message[" + quote(field.name) + "];");
        lines.push("  if (value != null) {");
        if (definition.kind === "MESSAGE") {
          lines.push("    bb.writeVarUint(" + field.value + ");");
        }
        if (field.isArray) {
          if (field.type === "byte") {
            lines.push("    bb.writeByteArray(value);");
          } else {
            lines.push("    var values = value, n = values.length;");
            lines.push("    bb.writeVarUint(n);");
            lines.push("    for (var i = 0; i < n; i++) {");
            lines.push("      value = values[i];");
            lines.push("      " + code);
            lines.push("    }");
          }
        } else {
          lines.push("    " + code);
        }
        if (definition.kind === "STRUCT") {
          lines.push("  } else {");
          lines.push("    throw new Error(" + quote("Missing required field " + quote(field.name)) + ");");
        }
        lines.push("  }");
      }
      if (definition.kind === "MESSAGE") {
        lines.push("  bb.writeVarUint(0);");
      }
      lines.push("");
      lines.push("  if (isTopLevel) return bb.toUint8Array();");
      lines.push("}");
      return lines.join("\n");
    }
    function compileSchemaJS(schema) {
      let definitions = {};
      let name = schema.package;
      let js = [];
      if (name !== null) {
        js.push("var " + name + " = exports || " + name + " || {}, exports;");
      } else {
        js.push("var exports = exports || {};");
        name = "exports";
      }
      js.push(name + ".ByteBuffer = " + name + '.ByteBuffer || require("kiwi-schema").ByteBuffer;');
      for (let i = 0; i < schema.definitions.length; i++) {
        let definition = schema.definitions[i];
        definitions[definition.name] = definition;
      }
      for (let i = 0; i < schema.definitions.length; i++) {
        let definition = schema.definitions[i];
        switch (definition.kind) {
          case "ENUM": {
            let value = {};
            for (let j = 0; j < definition.fields.length; j++) {
              let field = definition.fields[j];
              value[field.name] = field.value;
              value[field.value] = field.name;
            }
            js.push(name + "[" + quote(definition.name) + "] = " + JSON.stringify(value, null, 2) + ";");
            break;
          }
          case "STRUCT":
          case "MESSAGE": {
            js.push("");
            js.push(name + "[" + quote("decode" + definition.name) + "] = " + compileDecode(definition, definitions) + ";");
            js.push("");
            js.push(name + "[" + quote("encode" + definition.name) + "] = " + compileEncode(definition, definitions) + ";");
            break;
          }
          default: {
            error("Invalid definition kind " + quote(definition.kind), definition.line, definition.column);
            break;
          }
        }
      }
      js.push("");
      return js.join("\n");
    }
    function compileSchema2(schema) {
      let result = {
        ByteBuffer
      };
      new Function("exports", compileSchemaJS(schema))(result);
      return result;
    }
    function argumentForField(definitions, type, name) {
      switch (type) {
        case "bool":
          return { type: "bool ", name };
        case "byte":
          return { type: "uint8_t ", name };
        case "int":
          return { type: "int32_t ", name };
        case "uint":
          return { type: "uint32_t ", name };
        case "float":
          return { type: "float ", name };
        case "string":
          return { type: "const char *", name };
        case "int64":
          return { type: "int64_t ", name };
        case "uint64":
          return { type: "uint64_t ", name };
        default: {
          let definition = definitions[type];
          if (definition.kind === "ENUM")
            return { type: definition.name + " ", name };
          return null;
        }
      }
    }
    function extractStructArguments(definitions, prefix, fields, allowArrays) {
      let args = [];
      for (let i = 0; i < fields.length; i++) {
        let field = fields[i];
        let name = prefix + field.name;
        if (field.isArray && !allowArrays) {
          return null;
        }
        let arg = argumentForField(definitions, field.type, name);
        if (arg !== null) {
          args.push(arg);
          continue;
        }
        let type = definitions[field.type];
        if (type.kind !== "STRUCT") {
          return null;
        }
        let typeArgs = extractStructArguments(definitions, name + "_", type.fields, false);
        if (typeArgs === null) {
          return null;
        }
        args.push.apply(args, typeArgs);
      }
      return args;
    }
    function argToDeclaration(arg) {
      return arg.type + arg.name;
    }
    function argToName(arg) {
      return arg.name;
    }
    function argToNotRead(arg) {
      switch (arg.type) {
        case "bool ":
        case "uint8_t ":
          return "!bb.readByte(" + arg.name + ")";
        case "int32_t ":
          return "!bb.readVarInt(" + arg.name + ")";
        case "uint32_t ":
          return "!bb.readVarUint(" + arg.name + ")";
        case "float ":
          return "!bb.readVarFloat(" + arg.name + ")";
        case "const char *":
          return "!bb.readString(" + arg.name + ")";
        case "int64_t ":
          return "!bb.readVarInt64(" + arg.name + ")";
        case "uint64_t ":
          return "!bb.readVarUint64(" + arg.name + ")";
        default:
          return "!bb.readVarUint(reinterpret_cast<uint32_t &>(" + arg.name + "))";
      }
    }
    function argToWrite(arg) {
      switch (arg.type) {
        case "bool ":
        case "uint8_t ":
          return "_bb.writeByte(" + arg.name + ")";
        case "int32_t ":
          return "_bb.writeVarInt(" + arg.name + ")";
        case "uint32_t ":
          return "_bb.writeVarUint(" + arg.name + ")";
        case "float ":
          return "_bb.writeVarFloat(" + arg.name + ")";
        case "const char *":
          return "_bb.writeString(" + arg.name + ")";
        case "int64_t ":
          return "_bb.writeVarInt64(" + arg.name + ")";
        case "uint64_t ":
          return "_bb.writeVarUint64(" + arg.name + ")";
        default:
          return "_bb.writeVarUint(static_cast<uint32_t>(" + arg.name + "))";
      }
    }
    function emitReadField(cpp, definitions, definition, field, indent) {
      let name = field.name;
      if (field.isArray) {
        let count = "_" + name + "_count";
        cpp.push(indent + "uint32_t " + count + ";");
        cpp.push(indent + "if (!bb.readVarUint(" + count + ")) return false;");
        if (!field.isDeprecated) {
          cpp.push(indent + "visitor.visit" + definition.name + "_" + field.name + "_count(" + count + ");");
        }
        cpp.push(indent + "while (" + count + "-- > 0) {");
        indent += "  ";
        name += "_element";
      }
      let args = extractStructArguments(definitions, "", [field], true);
      if (args !== null) {
        for (let i = 0; i < args.length; i++) {
          cpp.push(indent + argToDeclaration(args[i]) + ";");
        }
        cpp.push(indent + "if (" + args.map(argToNotRead).join(" || ") + ") return false;");
        if (!field.isDeprecated) {
          cpp.push(indent + "visitor.visit" + definition.name + "_" + name + "(" + args.map(argToName).join(", ") + ");");
        }
      } else {
        if (!field.isDeprecated) {
          cpp.push(indent + "visitor.visit" + definition.name + "_" + name + "();");
        }
        let type = definitions[field.type];
        cpp.push(indent + "if (!parse" + type.name + "(bb, visitor)) return false;");
      }
      if (field.isArray) {
        cpp.push(indent.slice(2) + "}");
      }
    }
    function compileSchemaCallbackCPP(schema) {
      let definitions = {};
      let cpp = [];
      for (let i = 0; i < schema.definitions.length; i++) {
        let definition = schema.definitions[i];
        definitions[definition.name] = definition;
      }
      if (schema.package !== null) {
        cpp.push("#ifndef INCLUDE_" + schema.package.toUpperCase() + "_H");
        cpp.push("#define INCLUDE_" + schema.package.toUpperCase() + "_H");
        cpp.push("");
      }
      cpp.push('#include "kiwi.h"');
      cpp.push("");
      if (schema.package !== null) {
        cpp.push("namespace " + schema.package + " {");
        cpp.push("");
      }
      for (let i = 0; i < schema.definitions.length; i++) {
        let definition = schema.definitions[i];
        if (definition.kind === "ENUM") {
          cpp.push("enum class " + definition.name + " : uint32_t {");
          for (let j = 0; j < definition.fields.length; j++) {
            let field = definition.fields[j];
            if (!field.isDeprecated) {
              cpp.push("  " + field.name + " = " + field.value + ",");
            }
          }
          cpp.push("};");
          cpp.push("");
        }
      }
      for (let pass = 0; pass < 2; pass++) {
        let suffix = ") = 0;";
        if (pass === 0) {
          cpp.push("class Visitor {");
          cpp.push("public:");
        } else {
          cpp.push("class Writer : public Visitor {");
          cpp.push("private:");
          cpp.push("  kiwi::ByteBuffer &_bb;");
          cpp.push("public:");
          cpp.push("  Writer(kiwi::ByteBuffer &bb) : _bb(bb) {}");
          suffix = ") override;";
        }
        for (let i = 0; i < schema.definitions.length; i++) {
          let definition = schema.definitions[i];
          if (definition.kind === "STRUCT") {
            let args = extractStructArguments(definitions, "", definition.fields, false);
            if (args !== null) {
              cpp.push("  virtual void visit" + definition.name + "(" + args.map(argToDeclaration).join(", ") + suffix);
              continue;
            }
          }
          if (definition.kind === "STRUCT" || definition.kind === "MESSAGE") {
            cpp.push("  virtual void begin" + definition.name + "(" + suffix);
            for (let j = 0; j < definition.fields.length; j++) {
              let field = definition.fields[j];
              if (field.isDeprecated) {
                continue;
              }
              let name = field.name;
              if (field.isArray) {
                cpp.push("  virtual void visit" + definition.name + "_" + field.name + "_count(uint32_t size" + suffix);
                name += "_element";
              }
              let args = extractStructArguments(definitions, "", [field], true);
              if (args !== null) {
                cpp.push("  virtual void visit" + definition.name + "_" + name + "(" + args.map(argToDeclaration).join(", ") + suffix);
              } else {
                cpp.push("  virtual void visit" + definition.name + "_" + name + "(" + suffix);
              }
            }
            cpp.push("  virtual void end" + definition.name + "(" + suffix);
          }
        }
        cpp.push("};");
        cpp.push("");
      }
      for (let i = 0; i < schema.definitions.length; i++) {
        let definition = schema.definitions[i];
        if (definition.kind === "STRUCT" || definition.kind === "MESSAGE") {
          cpp.push("bool parse" + definition.name + "(kiwi::ByteBuffer &bb, Visitor &visitor);");
        }
      }
      cpp.push("");
      cpp.push("#ifdef IMPLEMENT_SCHEMA_H");
      cpp.push("");
      for (let i = 0; i < schema.definitions.length; i++) {
        let definition = schema.definitions[i];
        if (definition.kind === "STRUCT") {
          let args = extractStructArguments(definitions, "", definition.fields, false);
          if (args !== null) {
            cpp.push("bool parse" + definition.name + "(kiwi::ByteBuffer &bb, Visitor &visitor) {");
            for (let j = 0; j < args.length; j++) {
              cpp.push("  " + argToDeclaration(args[j]) + ";");
            }
            cpp.push("  if (" + args.map(argToNotRead).join(" || ") + ") return false;");
            cpp.push("  visitor.visit" + definition.name + "(" + args.map(argToName).join(", ") + ");");
            cpp.push("  return true;");
            cpp.push("}");
            cpp.push("");
          } else {
            cpp.push("bool parse" + definition.name + "(kiwi::ByteBuffer &bb, Visitor &visitor) {");
            cpp.push("  visitor.begin" + definition.name + "();");
            for (let j = 0; j < definition.fields.length; j++) {
              let field = definition.fields[j];
              emitReadField(cpp, definitions, definition, field, "  ");
            }
            cpp.push("  visitor.end" + definition.name + "();");
            cpp.push("  return true;");
            cpp.push("}");
            cpp.push("");
          }
        } else if (definition.kind === "MESSAGE") {
          cpp.push("bool parse" + definition.name + "(kiwi::ByteBuffer &bb, Visitor &visitor) {");
          cpp.push("  visitor.begin" + definition.name + "();");
          cpp.push("  while (true) {");
          cpp.push("    uint32_t _type;");
          cpp.push("    if (!bb.readVarUint(_type)) return false;");
          cpp.push("    switch (_type) {");
          cpp.push("      case 0: {");
          cpp.push("        visitor.end" + definition.name + "();");
          cpp.push("        return true;");
          cpp.push("      }");
          for (let j = 0; j < definition.fields.length; j++) {
            let field = definition.fields[j];
            cpp.push("      case " + field.value + ": {");
            emitReadField(cpp, definitions, definition, field, "        ");
            cpp.push("        break;");
            cpp.push("      }");
          }
          cpp.push("      default: return false;");
          cpp.push("    }");
          cpp.push("  }");
          cpp.push("}");
          cpp.push("");
        }
      }
      for (let i = 0; i < schema.definitions.length; i++) {
        let definition = schema.definitions[i];
        if (definition.kind === "STRUCT") {
          let args = extractStructArguments(definitions, "", definition.fields, false);
          if (args !== null) {
            cpp.push("void Writer::visit" + definition.name + "(" + args.map(argToDeclaration).join(", ") + ") {");
            for (let j = 0; j < args.length; j++) {
              cpp.push("  " + argToWrite(args[j]) + ";");
            }
            cpp.push("}");
            cpp.push("");
            continue;
          }
        }
        if (definition.kind === "STRUCT" || definition.kind === "MESSAGE") {
          cpp.push("void Writer::begin" + definition.name + "() {");
          cpp.push("}");
          cpp.push("");
          for (let j = 0; j < definition.fields.length; j++) {
            let field = definition.fields[j];
            if (field.isDeprecated) {
              continue;
            }
            let name = field.name;
            if (field.isArray) {
              cpp.push("void Writer::visit" + definition.name + "_" + field.name + "_count(uint32_t size) {");
              if (definition.kind === "MESSAGE") {
                cpp.push("  _bb.writeVarUint(" + field.value + ");");
              }
              cpp.push("  _bb.writeVarUint(size);");
              cpp.push("}");
              cpp.push("");
              name += "_element";
            }
            let args = extractStructArguments(definitions, "", [field], true);
            if (args !== null) {
              cpp.push("void Writer::visit" + definition.name + "_" + name + "(" + args.map(argToDeclaration).join(", ") + ") {");
              if (definition.kind === "MESSAGE" && !field.isArray) {
                cpp.push("  _bb.writeVarUint(" + field.value + ");");
              }
              for (let k = 0; k < args.length; k++) {
                cpp.push("  " + argToWrite(args[k]) + ";");
              }
              cpp.push("}");
              cpp.push("");
            } else {
              cpp.push("void Writer::visit" + definition.name + "_" + name + "() {");
              if (definition.kind === "MESSAGE" && !field.isArray) {
                cpp.push("  _bb.writeVarUint(" + field.value + ");");
              }
              cpp.push("}");
              cpp.push("");
            }
          }
          cpp.push("void Writer::end" + definition.name + "() {");
          if (definition.kind === "MESSAGE") {
            cpp.push("  _bb.writeVarUint(0);");
          }
          cpp.push("}");
          cpp.push("");
        }
      }
      cpp.push("#endif");
      cpp.push("");
      if (schema.package !== null) {
        cpp.push("}");
        cpp.push("");
        cpp.push("#endif");
        cpp.push("");
      }
      return cpp.join("\n");
    }
    function cppType(definitions, field, isArray) {
      let type;
      switch (field.type) {
        case "bool":
          type = "bool";
          break;
        case "byte":
          type = "uint8_t";
          break;
        case "int":
          type = "int32_t";
          break;
        case "uint":
          type = "uint32_t";
          break;
        case "float":
          type = "float";
          break;
        case "string":
          type = "kiwi::String";
          break;
        case "int64":
          type = "int64_t";
          break;
        case "uint64":
          type = "uint64_t";
          break;
        default: {
          let definition = definitions[field.type];
          if (!definition) {
            error("Invalid type " + quote(field.type) + " for field " + quote(field.name), field.line, field.column);
          }
          type = definition.name;
          break;
        }
      }
      if (isArray) {
        type = "kiwi::Array<" + type + ">";
      }
      return type;
    }
    function cppFieldName(field) {
      return "_data_" + field.name;
    }
    function cppFlagIndex(i) {
      return i >> 5;
    }
    function cppFlagMask(i) {
      return 1 << i % 32 >>> 0;
    }
    function cppIsFieldPointer(definitions, field) {
      return !field.isArray && field.type in definitions && definitions[field.type].kind !== "ENUM";
    }
    function compileSchemaCPP(schema) {
      let definitions = {};
      let cpp = [];
      cpp.push('#include "kiwi.h"');
      cpp.push("");
      if (schema.package !== null) {
        cpp.push("namespace " + schema.package + " {");
        cpp.push("");
        cpp.push("#ifndef INCLUDE_" + schema.package.toUpperCase() + "_H");
        cpp.push("#define INCLUDE_" + schema.package.toUpperCase() + "_H");
        cpp.push("");
      }
      for (let i = 0; i < schema.definitions.length; i++) {
        let definition = schema.definitions[i];
        definitions[definition.name] = definition;
      }
      cpp.push("class BinarySchema {");
      cpp.push("public:");
      cpp.push("  bool parse(kiwi::ByteBuffer &bb);");
      cpp.push("  const kiwi::BinarySchema &underlyingSchema() const { return _schema; }");
      for (let i = 0; i < schema.definitions.length; i++) {
        let definition = schema.definitions[i];
        if (definition.kind === "MESSAGE") {
          cpp.push("  bool skip" + definition.name + "Field(kiwi::ByteBuffer &bb, uint32_t id) const;");
        }
      }
      cpp.push("");
      cpp.push("private:");
      cpp.push("  kiwi::BinarySchema _schema;");
      for (let i = 0; i < schema.definitions.length; i++) {
        let definition = schema.definitions[i];
        if (definition.kind === "MESSAGE") {
          cpp.push("  uint32_t _index" + definition.name + " = 0;");
        }
      }
      cpp.push("};");
      cpp.push("");
      for (let i = 0; i < schema.definitions.length; i++) {
        let definition = schema.definitions[i];
        if (definition.kind === "ENUM") {
          cpp.push("enum class " + definition.name + " : uint32_t {");
          for (let j = 0; j < definition.fields.length; j++) {
            let field = definition.fields[j];
            cpp.push("  " + field.name + " = " + field.value + ",");
          }
          cpp.push("};");
          cpp.push("");
        } else if (definition.kind !== "STRUCT" && definition.kind !== "MESSAGE") {
          error("Invalid definition kind " + quote(definition.kind), definition.line, definition.column);
        }
      }
      for (let pass = 0; pass < 3; pass++) {
        let newline = false;
        if (pass === 2) {
          if (schema.package !== null) {
            cpp.push("#endif");
          }
          cpp.push("#ifdef IMPLEMENT_SCHEMA_H");
          cpp.push("");
          cpp.push("bool BinarySchema::parse(kiwi::ByteBuffer &bb) {");
          cpp.push("  if (!_schema.parse(bb)) return false;");
          for (let i = 0; i < schema.definitions.length; i++) {
            let definition = schema.definitions[i];
            if (definition.kind === "MESSAGE") {
              cpp.push('  _schema.findDefinition("' + definition.name + '", _index' + definition.name + ");");
            }
          }
          cpp.push("  return true;");
          cpp.push("}");
          cpp.push("");
          for (let i = 0; i < schema.definitions.length; i++) {
            let definition = schema.definitions[i];
            if (definition.kind === "MESSAGE") {
              cpp.push("bool BinarySchema::skip" + definition.name + "Field(kiwi::ByteBuffer &bb, uint32_t id) const {");
              cpp.push("  return _schema.skipField(bb, _index" + definition.name + ", id);");
              cpp.push("}");
              cpp.push("");
            }
          }
        }
        for (let i = 0; i < schema.definitions.length; i++) {
          let definition = schema.definitions[i];
          if (definition.kind === "ENUM") {
            continue;
          }
          let fields = definition.fields;
          if (pass === 0) {
            cpp.push("class " + definition.name + ";");
            newline = true;
          } else if (pass === 1) {
            cpp.push("class " + definition.name + " {");
            cpp.push("public:");
            cpp.push("  " + definition.name + "() { (void)_flags; }");
            cpp.push("");
            for (let j = 0; j < fields.length; j++) {
              let field = fields[j];
              if (field.isDeprecated) {
                continue;
              }
              let type = cppType(definitions, field, field.isArray);
              if (cppIsFieldPointer(definitions, field)) {
                cpp.push("  " + type + " *" + field.name + "();");
                cpp.push("  const " + type + " *" + field.name + "() const;");
                cpp.push("  void set_" + field.name + "(" + type + " *value);");
              } else if (field.isArray) {
                cpp.push("  " + type + " *" + field.name + "();");
                cpp.push("  const " + type + " *" + field.name + "() const;");
                cpp.push("  " + type + " &set_" + field.name + "(kiwi::MemoryPool &pool, uint32_t count);");
              } else {
                cpp.push("  " + type + " *" + field.name + "();");
                cpp.push("  const " + type + " *" + field.name + "() const;");
                cpp.push("  void set_" + field.name + "(const " + type + " &value);");
              }
              cpp.push("");
            }
            cpp.push("  bool encode(kiwi::ByteBuffer &bb);");
            cpp.push("  bool decode(kiwi::ByteBuffer &bb, kiwi::MemoryPool &pool, const BinarySchema *schema = nullptr);");
            cpp.push("");
            cpp.push("private:");
            cpp.push("  uint32_t _flags[" + (fields.length + 31 >> 5) + "] = {};");
            let sizes = { "bool": 1, "byte": 1, "int": 4, "uint": 4, "float": 4 };
            let sortedFields = fields.slice().sort(function(a, b) {
              let sizeA = !a.isArray && sizes[a.type] || 8;
              let sizeB = !b.isArray && sizes[b.type] || 8;
              if (sizeA !== sizeB)
                return sizeB - sizeA;
              return fields.indexOf(a) - fields.indexOf(b);
            });
            for (let j = 0; j < sortedFields.length; j++) {
              let field = sortedFields[j];
              if (field.isDeprecated) {
                continue;
              }
              let name = cppFieldName(field);
              let type = cppType(definitions, field, field.isArray);
              if (cppIsFieldPointer(definitions, field)) {
                cpp.push("  " + type + " *" + name + " = {};");
              } else {
                cpp.push("  " + type + " " + name + " = {};");
              }
            }
            cpp.push("};");
            cpp.push("");
          } else {
            for (let j = 0; j < fields.length; j++) {
              let field = fields[j];
              let name = cppFieldName(field);
              let type = cppType(definitions, field, field.isArray);
              let flagIndex = cppFlagIndex(j);
              let flagMask = cppFlagMask(j);
              if (field.isDeprecated) {
                continue;
              }
              if (cppIsFieldPointer(definitions, field)) {
                cpp.push(type + " *" + definition.name + "::" + field.name + "() {");
                cpp.push("  return " + name + ";");
                cpp.push("}");
                cpp.push("");
                cpp.push("const " + type + " *" + definition.name + "::" + field.name + "() const {");
                cpp.push("  return " + name + ";");
                cpp.push("}");
                cpp.push("");
                cpp.push("void " + definition.name + "::set_" + field.name + "(" + type + " *value) {");
                cpp.push("  " + name + " = value;");
                cpp.push("}");
                cpp.push("");
              } else if (field.isArray) {
                cpp.push(type + " *" + definition.name + "::" + field.name + "() {");
                cpp.push("  return _flags[" + flagIndex + "] & " + flagMask + " ? &" + name + " : nullptr;");
                cpp.push("}");
                cpp.push("");
                cpp.push("const " + type + " *" + definition.name + "::" + field.name + "() const {");
                cpp.push("  return _flags[" + flagIndex + "] & " + flagMask + " ? &" + name + " : nullptr;");
                cpp.push("}");
                cpp.push("");
                cpp.push(type + " &" + definition.name + "::set_" + field.name + "(kiwi::MemoryPool &pool, uint32_t count) {");
                cpp.push("  _flags[" + flagIndex + "] |= " + flagMask + "; return " + name + " = pool.array<" + cppType(definitions, field, false) + ">(count);");
                cpp.push("}");
                cpp.push("");
              } else {
                cpp.push(type + " *" + definition.name + "::" + field.name + "() {");
                cpp.push("  return _flags[" + flagIndex + "] & " + flagMask + " ? &" + name + " : nullptr;");
                cpp.push("}");
                cpp.push("");
                cpp.push("const " + type + " *" + definition.name + "::" + field.name + "() const {");
                cpp.push("  return _flags[" + flagIndex + "] & " + flagMask + " ? &" + name + " : nullptr;");
                cpp.push("}");
                cpp.push("");
                cpp.push("void " + definition.name + "::set_" + field.name + "(const " + type + " &value) {");
                cpp.push("  _flags[" + flagIndex + "] |= " + flagMask + "; " + name + " = value;");
                cpp.push("}");
                cpp.push("");
              }
            }
            cpp.push("bool " + definition.name + "::encode(kiwi::ByteBuffer &_bb) {");
            for (let j = 0; j < fields.length; j++) {
              let field = fields[j];
              if (field.isDeprecated) {
                continue;
              }
              let name = cppFieldName(field);
              let value = field.isArray ? "_it" : name;
              let flagIndex = cppFlagIndex(j);
              let flagMask = cppFlagMask(j);
              let code;
              switch (field.type) {
                case "bool": {
                  code = "_bb.writeByte(" + value + ");";
                  break;
                }
                case "byte": {
                  code = "_bb.writeByte(" + value + ");";
                  break;
                }
                case "int": {
                  code = "_bb.writeVarInt(" + value + ");";
                  break;
                }
                case "uint": {
                  code = "_bb.writeVarUint(" + value + ");";
                  break;
                }
                case "float": {
                  code = "_bb.writeVarFloat(" + value + ");";
                  break;
                }
                case "string": {
                  code = "_bb.writeString(" + value + ".c_str());";
                  break;
                }
                case "int64": {
                  code = "_bb.writeVarInt64(" + value + ");";
                  break;
                }
                case "uint64": {
                  code = "_bb.writeVarUint64(" + value + ");";
                  break;
                }
                default: {
                  let type = definitions[field.type];
                  if (!type) {
                    error("Invalid type " + quote(field.type) + " for field " + quote(field.name), field.line, field.column);
                  } else if (type.kind === "ENUM") {
                    code = "_bb.writeVarUint(static_cast<uint32_t>(" + value + "));";
                  } else {
                    code = "if (!" + value + (cppIsFieldPointer(definitions, field) ? "->" : ".") + "encode(_bb)) return false;";
                  }
                }
              }
              let indent = "  ";
              if (definition.kind === "STRUCT") {
                cpp.push("  if (" + field.name + "() == nullptr) return false;");
              } else {
                cpp.push("  if (" + field.name + "() != nullptr) {");
                indent = "    ";
              }
              if (definition.kind === "MESSAGE") {
                cpp.push(indent + "_bb.writeVarUint(" + field.value + ");");
              }
              if (field.isArray) {
                cpp.push(indent + "_bb.writeVarUint(" + name + ".size());");
                cpp.push(indent + "for (" + cppType(definitions, field, false) + " &_it : " + name + ") " + code);
              } else {
                cpp.push(indent + code);
              }
              if (definition.kind !== "STRUCT") {
                cpp.push("  }");
              }
            }
            if (definition.kind === "MESSAGE") {
              cpp.push("  _bb.writeVarUint(0);");
            }
            cpp.push("  return true;");
            cpp.push("}");
            cpp.push("");
            cpp.push("bool " + definition.name + "::decode(kiwi::ByteBuffer &_bb, kiwi::MemoryPool &_pool, const BinarySchema *_schema) {");
            for (let j = 0; j < fields.length; j++) {
              if (fields[j].isArray) {
                cpp.push("  uint32_t _count;");
                break;
              }
            }
            if (definition.kind === "MESSAGE") {
              cpp.push("  while (true) {");
              cpp.push("    uint32_t _type;");
              cpp.push("    if (!_bb.readVarUint(_type)) return false;");
              cpp.push("    switch (_type) {");
              cpp.push("      case 0:");
              cpp.push("        return true;");
            }
            for (let j = 0; j < fields.length; j++) {
              let field = fields[j];
              let name = cppFieldName(field);
              let value = field.isArray ? "_it" : name;
              let isPointer = cppIsFieldPointer(definitions, field);
              let code;
              switch (field.type) {
                case "bool": {
                  code = "_bb.readByte(" + value + ")";
                  break;
                }
                case "byte": {
                  code = "_bb.readByte(" + value + ")";
                  break;
                }
                case "int": {
                  code = "_bb.readVarInt(" + value + ")";
                  break;
                }
                case "uint": {
                  code = "_bb.readVarUint(" + value + ")";
                  break;
                }
                case "float": {
                  code = "_bb.readVarFloat(" + value + ")";
                  break;
                }
                case "string": {
                  code = "_bb.readString(" + value + ", _pool)";
                  break;
                }
                case "int64": {
                  code = "_bb.readVarInt64(" + value + ")";
                  break;
                }
                case "uint64": {
                  code = "_bb.readVarUint64(" + value + ")";
                  break;
                }
                default: {
                  let type2 = definitions[field.type];
                  if (!type2) {
                    error("Invalid type " + quote(field.type) + " for field " + quote(field.name), field.line, field.column);
                  } else if (type2.kind === "ENUM") {
                    code = "_bb.readVarUint(reinterpret_cast<uint32_t &>(" + value + "))";
                  } else {
                    code = value + (isPointer ? "->" : ".") + "decode(_bb, _pool, _schema)";
                  }
                }
              }
              let type = cppType(definitions, field, false);
              let indent = "  ";
              if (definition.kind === "MESSAGE") {
                cpp.push("      case " + field.value + ": {");
                indent = "        ";
              }
              if (field.isArray) {
                cpp.push(indent + "if (!_bb.readVarUint(_count)) return false;");
                if (field.isDeprecated) {
                  cpp.push(indent + "for (" + type + " &_it : _pool.array<" + cppType(definitions, field, false) + ">(_count)) if (!" + code + ") return false;");
                } else {
                  cpp.push(indent + "for (" + type + " &_it : set_" + field.name + "(_pool, _count)) if (!" + code + ") return false;");
                }
              } else {
                if (field.isDeprecated) {
                  if (isPointer) {
                    cpp.push(indent + type + " *" + name + " = _pool.allocate<" + type + ">();");
                  } else {
                    cpp.push(indent + type + " " + name + " = {};");
                  }
                  cpp.push(indent + "if (!" + code + ") return false;");
                } else {
                  if (isPointer) {
                    cpp.push(indent + name + " = _pool.allocate<" + type + ">();");
                  }
                  cpp.push(indent + "if (!" + code + ") return false;");
                  if (!isPointer) {
                    cpp.push(indent + "set_" + field.name + "(" + name + ");");
                  }
                }
              }
              if (definition.kind === "MESSAGE") {
                cpp.push("        break;");
                cpp.push("      }");
              }
            }
            if (definition.kind === "MESSAGE") {
              cpp.push("      default: {");
              cpp.push("        if (!_schema || !_schema->skip" + definition.name + "Field(_bb, _type)) return false;");
              cpp.push("        break;");
              cpp.push("      }");
              cpp.push("    }");
              cpp.push("  }");
            } else {
              cpp.push("  return true;");
            }
            cpp.push("}");
            cpp.push("");
          }
        }
        if (pass === 2) {
          cpp.push("#endif");
          cpp.push("");
        } else if (newline)
          cpp.push("");
      }
      if (schema.package !== null) {
        cpp.push("}");
        cpp.push("");
      }
      return cpp.join("\n");
    }
    function popTrailingNewline(lines) {
      if (lines[lines.length - 1] === "") {
        lines.pop();
      }
    }
    function skewDefaultValueForField(definitions, field) {
      if (field.isArray) {
        return "null";
      }
      switch (field.type) {
        case "bool":
          return "false";
        case "byte":
        case "int":
        case "uint":
          return "0";
        case "float":
          return "0.0";
        case "string":
          return "null";
        case "int64":
        case "uint64":
          return "BigInt.new(0)";
      }
      let def = definitions[field.type];
      if (def.kind === "ENUM") {
        if (def.fields.length > 0) {
          return "." + def.fields[0].name;
        }
        return "0 as " + field.type;
      }
      return "null";
    }
    function skewTypeForField(field) {
      let type;
      switch (field.type) {
        case "bool":
          type = "bool";
          break;
        case "byte":
        case "int":
        case "uint":
          type = "int";
          break;
        case "float":
          type = "double";
          break;
        case "string":
          type = "string";
          break;
        case "int64":
        case "uint64":
          type = "BigInt";
          break;
        default:
          type = field.type;
          break;
      }
      if (field.isArray) {
        type = "List<" + type + ">";
      }
      return type;
    }
    function compileSchemaSkew(schema) {
      let definitions = {};
      let indent = "";
      let lines = [];
      if (schema.package !== null) {
        lines.push("namespace " + schema.package + " {");
        indent += "  ";
      }
      for (let i = 0; i < schema.definitions.length; i++) {
        let definition = schema.definitions[i];
        definitions[definition.name] = definition;
      }
      lines.push(indent + "class BinarySchema {");
      lines.push(indent + "  var _schema = Kiwi.BinarySchema.new");
      for (let i = 0; i < schema.definitions.length; i++) {
        let definition = schema.definitions[i];
        if (definition.kind === "MESSAGE") {
          lines.push(indent + "  var _index" + definition.name + " = 0");
        }
      }
      lines.push("");
      lines.push(indent + "  def parse(bytes Uint8Array) {");
      lines.push(indent + "    _schema.parse(Kiwi.ByteBuffer.new(bytes))");
      for (let i = 0; i < schema.definitions.length; i++) {
        let definition = schema.definitions[i];
        if (definition.kind === "MESSAGE") {
          lines.push(indent + "    _index" + definition.name + ' = _schema.findDefinition("' + definition.name + '")');
        }
      }
      lines.push(indent + "  }");
      for (let i = 0; i < schema.definitions.length; i++) {
        let definition = schema.definitions[i];
        if (definition.kind === "MESSAGE") {
          lines.push("");
          lines.push(indent + "  def skip" + definition.name + "Field(bb Kiwi.ByteBuffer, id int) {");
          lines.push(indent + "    _schema.skipField(bb, _index" + definition.name + ", id)");
          lines.push(indent + "  }");
        }
      }
      lines.push(indent + "}");
      lines.push("");
      for (let i = 0; i < schema.definitions.length; i++) {
        let definition = schema.definitions[i];
        switch (definition.kind) {
          case "ENUM": {
            let encode = {};
            let decode = {};
            lines.push(indent + "enum " + definition.name + " {");
            for (let j = 0; j < definition.fields.length; j++) {
              let field = definition.fields[j];
              encode[field.name] = field.value;
              decode[field.value] = field.name;
              lines.push(indent + "  " + field.name);
            }
            lines.push(indent + "}");
            lines.push("");
            lines.push(indent + "namespace " + definition.name + " {");
            lines.push(indent + "  const _encode = " + JSON.stringify(encode, null, 2).replace(/"/g, "").replace(/\n/g, "\n  " + indent));
            lines.push("");
            lines.push(indent + "  const _decode = " + JSON.stringify(decode, null, 2).replace(/"/g, "").replace(/\n/g, "\n  " + indent));
            lines.push("");
            lines.push(indent + "  def encode(value " + definition.name + ") int {");
            lines.push(indent + "    return _encode[value]");
            lines.push(indent + "  }");
            lines.push("");
            lines.push(indent + "  def decode(value int) " + definition.name + " {");
            lines.push(indent + "    if !(value in _decode) {");
            lines.push(indent + "      Kiwi.DecodeError.throwInvalidEnumValue(" + quote(definition.name) + ")");
            lines.push(indent + "    }");
            lines.push(indent + "    return _decode[value]");
            lines.push(indent + "  }");
            lines.push(indent + "}");
            lines.push("");
            break;
          }
          case "STRUCT":
          case "MESSAGE": {
            lines.push(indent + "class " + definition.name + " {");
            for (let j = 0; j < definition.fields.length; j += 32) {
              lines.push(indent + "  var _flags" + (j >> 5) + " = 0");
            }
            for (let j = 0; j < definition.fields.length; j++) {
              let field = definition.fields[j];
              if (field.isDeprecated) {
                continue;
              }
              lines.push(indent + "  var _" + field.name + " " + skewTypeForField(field) + " = " + skewDefaultValueForField(definitions, field));
            }
            lines.push("");
            for (let j = 0; j < definition.fields.length; j++) {
              let field = definition.fields[j];
              if (field.isDeprecated) {
                continue;
              }
              let type = skewTypeForField(field);
              let flags = "_flags" + (j >> 5);
              let mask = "" + (1 << j % 32 >>> 0);
              lines.push(indent + "  def has_" + field.name + " bool {");
              lines.push(indent + "    return (" + flags + " & " + mask + ") != 0");
              lines.push(indent + "  }");
              lines.push("");
              lines.push(indent + "  def " + field.name + " " + type + " {");
              lines.push(indent + "    assert(has_" + field.name + ")");
              lines.push(indent + "    return _" + field.name);
              lines.push(indent + "  }");
              lines.push("");
              lines.push(indent + "  def " + field.name + "=(value " + type + ") {");
              lines.push(indent + "    _" + field.name + " = value");
              lines.push(indent + "    " + flags + " |= " + mask);
              lines.push(indent + "  }");
              lines.push("");
            }
            lines.push(indent + "  def encode(bb Kiwi.ByteBuffer) {");
            for (let j = 0; j < definition.fields.length; j++) {
              let field = definition.fields[j];
              if (field.isDeprecated) {
                continue;
              }
              let value = "_" + field.name;
              let code;
              if (field.isArray) {
                value = "value";
              }
              switch (field.type) {
                case "bool": {
                  code = "bb.writeByte(" + value + " as int)";
                  break;
                }
                case "byte": {
                  code = "bb.writeByte(" + value + ")";
                  break;
                }
                case "int": {
                  code = "bb.writeVarInt(" + value + ")";
                  break;
                }
                case "uint": {
                  code = "bb.writeVarUint(" + value + ")";
                  break;
                }
                case "float": {
                  code = "bb.writeVarFloat(" + value + ")";
                  break;
                }
                case "string": {
                  code = "bb.writeString(" + value + ")";
                  break;
                }
                case "int64": {
                  code = "bb.writeVarInt64(" + value + ")";
                  break;
                }
                case "uint64": {
                  code = "bb.writeVarUint64(" + value + ")";
                  break;
                }
                default: {
                  let type = definitions[field.type];
                  if (!type) {
                    error("Invalid type " + quote(field.type) + " for field " + quote(field.name), field.line, field.column);
                  } else if (type.kind === "ENUM") {
                    code = "bb.writeVarUint(" + type.name + ".encode(" + value + "))";
                  } else {
                    code = value + ".encode(bb)";
                  }
                }
              }
              let nestedIndent2 = indent + "    ";
              if (definition.kind === "STRUCT") {
                lines.push(nestedIndent2 + "assert(has_" + field.name + ")");
              } else {
                lines.push(nestedIndent2 + "if has_" + field.name + " {");
                nestedIndent2 += "  ";
              }
              if (definition.kind === "MESSAGE") {
                lines.push(nestedIndent2 + "bb.writeVarUint(" + field.value + ")");
              }
              if (field.isArray) {
                lines.push(nestedIndent2 + "bb.writeVarUint(_" + field.name + ".count)");
                lines.push(nestedIndent2 + "for value in _" + field.name + " {");
                lines.push(nestedIndent2 + "  " + code);
                lines.push(nestedIndent2 + "}");
              } else {
                lines.push(nestedIndent2 + code);
              }
              if (definition.kind !== "STRUCT") {
                lines.push(indent + "    }");
              }
              lines.push("");
            }
            if (definition.kind === "MESSAGE") {
              lines.push(indent + "    bb.writeVarUint(0)");
            } else {
              popTrailingNewline(lines);
            }
            lines.push(indent + "  }");
            lines.push("");
            lines.push(indent + "  def encode Uint8Array {");
            lines.push(indent + "    var bb = Kiwi.ByteBuffer.new");
            lines.push(indent + "    encode(bb)");
            lines.push(indent + "    return bb.toUint8Array");
            lines.push(indent + "  }");
            lines.push(indent + "}");
            lines.push("");
            lines.push(indent + "namespace " + definition.name + " {");
            lines.push(indent + "  def decode(bytes Uint8Array) " + definition.name + " {");
            lines.push(indent + "    return decode(Kiwi.ByteBuffer.new(bytes), null)");
            lines.push(indent + "  }");
            lines.push("");
            lines.push(indent + "  def decode(bytes Uint8Array, schema BinarySchema) " + definition.name + " {");
            lines.push(indent + "    return decode(Kiwi.ByteBuffer.new(bytes), schema)");
            lines.push(indent + "  }");
            lines.push("");
            lines.push(indent + "  def decode(bb Kiwi.ByteBuffer, schema BinarySchema) " + definition.name + " {");
            lines.push(indent + "    var self = new");
            for (let j = 0; j < definition.fields.length; j++) {
              if (definition.fields[j].isArray) {
                lines.push(indent + "    var count = 0");
                break;
              }
            }
            let nestedIndent = indent + "  ";
            if (definition.kind === "MESSAGE") {
              lines.push(indent + "    while true {");
              lines.push(indent + "      var type = bb.readVarUint");
              lines.push(indent + "      switch type {");
              lines.push(indent + "        case 0 {");
              lines.push(indent + "          break");
              lines.push(indent + "        }");
              lines.push("");
              nestedIndent += "      ";
            }
            for (let j = 0; j < definition.fields.length; j++) {
              let field = definition.fields[j];
              let code;
              switch (field.type) {
                case "bool": {
                  code = field.isDeprecated ? "bb.readByte" : "bb.readByte as bool";
                  break;
                }
                case "byte": {
                  code = "bb.readByte";
                  break;
                }
                case "int": {
                  code = "bb.readVarInt";
                  break;
                }
                case "uint": {
                  code = "bb.readVarUint";
                  break;
                }
                case "float": {
                  code = "bb.readVarFloat";
                  break;
                }
                case "string": {
                  code = "bb.readString";
                  break;
                }
                case "int64": {
                  code = "bb.readVarInt64";
                  break;
                }
                case "uint64": {
                  code = "bb.readVarUint64";
                  break;
                }
                default: {
                  let type = definitions[field.type];
                  if (!type) {
                    error("Invalid type " + quote(field.type) + " for field " + quote(field.name), field.line, field.column);
                  } else if (type.kind === "ENUM") {
                    code = type.name + ".decode(bb.readVarUint)";
                  } else {
                    code = type.name + ".decode(bb, schema)";
                  }
                }
              }
              if (definition.kind === "MESSAGE") {
                lines.push(nestedIndent + "case " + field.value + " {");
              }
              if (field.isArray) {
                if (field.isDeprecated) {
                  lines.push(nestedIndent + "  for i in 0..bb.readVarUint {");
                  lines.push(nestedIndent + "    " + code);
                  lines.push(nestedIndent + "  }");
                } else {
                  lines.push(nestedIndent + "  count = bb.readVarUint");
                  lines.push(nestedIndent + "  self." + field.name + " = []");
                  lines.push(nestedIndent + "  for array = self._" + field.name + "; count != 0; count-- {");
                  lines.push(nestedIndent + "    array.append(" + code + ")");
                  lines.push(nestedIndent + "  }");
                }
              } else {
                if (field.isDeprecated) {
                  lines.push(nestedIndent + "  " + code);
                } else {
                  lines.push(nestedIndent + "  self." + field.name + " = " + code);
                }
              }
              if (definition.kind === "MESSAGE") {
                lines.push(nestedIndent + "}");
                lines.push("");
              }
            }
            if (definition.kind === "MESSAGE") {
              lines.push(indent + "        default {");
              lines.push(indent + "          if schema == null { Kiwi.DecodeError.throwInvalidMessage }");
              lines.push(indent + "          else { schema.skip" + definition.name + "Field(bb, type) }");
              lines.push(indent + "        }");
              lines.push(indent + "      }");
              lines.push(indent + "    }");
            }
            lines.push(indent + "    return self");
            lines.push(indent + "  }");
            lines.push(indent + "}");
            lines.push("");
            break;
          }
          default: {
            error("Invalid definition kind " + quote(definition.kind), definition.line, definition.column);
            break;
          }
        }
      }
      if (schema.package !== null) {
        popTrailingNewline(lines);
        lines.push("}");
      }
      lines.push("");
      return lines.join("\n");
    }
    function compileSchemaSkewTypes(schema) {
      var indent = "";
      var lines = [];
      if (schema.package !== null) {
        lines.push("namespace " + schema.package + " {");
        indent += "  ";
      }
      for (var i = 0; i < schema.definitions.length; i++) {
        var definition = schema.definitions[i];
        if (definition.kind === "ENUM") {
          lines.push(indent + "type " + definition.name + " : string {");
          lines.push(indent + "  @alwaysinline");
          lines.push(indent + "  def toString string { return self as string }");
          lines.push(indent + "}");
          if (definition.fields.length > 0) {
            lines.push(indent + "namespace " + definition.name + " {");
            for (var j = 0; j < definition.fields.length; j++) {
              lines.push(indent + "  @alwaysinline");
              lines.push(indent + "  def " + definition.fields[j].name + " " + definition.name + " { return " + JSON.stringify(definition.fields[j].name) + " as " + definition.name + " }");
            }
            lines.push(indent + "}");
          }
          lines.push("");
        }
      }
      for (var i = 0; i < schema.definitions.length; i++) {
        var definition = schema.definitions[i];
        if (definition.kind === "STRUCT" || definition.kind === "MESSAGE") {
          lines.push(indent + "@import");
          lines.push(indent + "class " + definition.name + " {");
          for (var j = 0; j < definition.fields.length; j++) {
            var field = definition.fields[j];
            var type;
            if (field.isDeprecated) {
              continue;
            }
            switch (field.type) {
              case "byte":
              case "uint":
                type = "int";
                break;
              case "float":
                type = "double";
                break;
              case "int64":
              case "uint64":
                type = "BigInt";
                break;
              default:
                type = field.type;
                break;
            }
            if (field.type === "byte" && field.isArray)
              type = "Uint8Array";
            else if (field.isArray)
              type = "List<" + type + ">";
            lines.push(indent + "  var " + field.name + " " + type);
            lines.push(indent + "  @alwaysinline");
            lines.push(indent + "  def has_" + field.name + " bool { return self." + field.name + " != dynamic.void(0) }");
          }
          lines.push(indent + "}");
          lines.push("");
          lines.push(indent + "namespace " + definition.name + " {");
          lines.push(indent + "  @alwaysinline");
          lines.push(indent + "  def new " + definition.name + " { return {} as dynamic }");
          lines.push(indent + "}");
          lines.push("");
        } else if (definition.kind !== "ENUM") {
          error("Invalid definition kind " + quote(definition.kind), definition.line, definition.column);
        }
      }
      lines.push(indent + "@import");
      lines.push(indent + "class Schema {");
      for (var i = 0; i < schema.definitions.length; i++) {
        var definition = schema.definitions[i];
        if (definition.kind === "ENUM") {
          lines.push(indent + "  const " + definition.name + " dynamic");
        } else if (definition.kind === "STRUCT" || definition.kind === "MESSAGE") {
          lines.push(indent + "  def encode" + definition.name + "(message " + definition.name + ") Uint8Array");
          lines.push(indent + "  def decode" + definition.name + "(buffer Uint8Array) " + definition.name);
        }
      }
      lines.push(indent + "}");
      if (schema.package !== null) {
        lines.push("}");
      }
      lines.push("");
      return lines.join("\n");
    }
    function compileSchemaTypeScript(schema) {
      var indent = "";
      var lines = [];
      if (schema.package !== null) {
        lines.push("export namespace " + schema.package + " {");
        indent += "  ";
      }
      for (var i = 0; i < schema.definitions.length; i++) {
        var definition = schema.definitions[i];
        if (definition.kind === "ENUM") {
          lines.push(indent + "export type " + definition.name + " =");
          for (var j = 0; j < definition.fields.length; j++) {
            lines.push(indent + "  " + JSON.stringify(definition.fields[j].name) + (j + 1 < definition.fields.length ? " |" : ";"));
          }
          if (!definition.fields.length) {
            lines.push(indent + "  any;");
          }
          lines.push("");
        }
      }
      for (var i = 0; i < schema.definitions.length; i++) {
        var definition = schema.definitions[i];
        if (definition.kind === "STRUCT" || definition.kind === "MESSAGE") {
          lines.push(indent + "export interface " + definition.name + " {");
          for (var j = 0; j < definition.fields.length; j++) {
            var field = definition.fields[j];
            var type;
            if (field.isDeprecated) {
              continue;
            }
            switch (field.type) {
              case "bool":
                type = "boolean";
                break;
              case "byte":
              case "int":
              case "uint":
              case "float":
                type = "number";
                break;
              case "int64":
              case "uint64":
                type = "bigint";
                break;
              default:
                type = field.type;
                break;
            }
            if (field.type === "byte" && field.isArray)
              type = "Uint8Array";
            else if (field.isArray)
              type += "[]";
            lines.push(indent + "  " + field.name + (definition.kind === "MESSAGE" ? "?" : "") + ": " + type + ";");
          }
          lines.push(indent + "}");
          lines.push("");
        } else if (definition.kind !== "ENUM") {
          error("Invalid definition kind " + quote(definition.kind), definition.line, definition.column);
        }
      }
      lines.push(indent + "export interface Schema {");
      for (var i = 0; i < schema.definitions.length; i++) {
        var definition = schema.definitions[i];
        if (definition.kind === "ENUM") {
          lines.push(indent + "  " + definition.name + ": any;");
        } else if (definition.kind === "STRUCT" || definition.kind === "MESSAGE") {
          lines.push(indent + "  encode" + definition.name + "(message: " + definition.name + "): Uint8Array;");
          lines.push(indent + "  decode" + definition.name + "(buffer: Uint8Array): " + definition.name + ";");
        }
      }
      lines.push(indent + "}");
      if (schema.package !== null) {
        lines.push("}");
      }
      lines.push("");
      return lines.join("\n");
    }
    var types = ["bool", "byte", "int", "uint", "float", "string", "int64", "uint64"];
    var kinds = ["ENUM", "STRUCT", "MESSAGE"];
    function decodeBinarySchema2(buffer) {
      let bb = buffer instanceof ByteBuffer ? buffer : new ByteBuffer(buffer);
      let definitionCount = bb.readVarUint();
      let definitions = [];
      for (let i = 0; i < definitionCount; i++) {
        let definitionName = bb.readString();
        let kind = bb.readByte();
        let fieldCount = bb.readVarUint();
        let fields = [];
        for (let j = 0; j < fieldCount; j++) {
          let fieldName = bb.readString();
          let type = bb.readVarInt();
          let isArray = !!(bb.readByte() & 1);
          let value = bb.readVarUint();
          fields.push({
            name: fieldName,
            line: 0,
            column: 0,
            type: kinds[kind] === "ENUM" ? null : type,
            isArray,
            isDeprecated: false,
            value
          });
        }
        definitions.push({
          name: definitionName,
          line: 0,
          column: 0,
          kind: kinds[kind],
          fields
        });
      }
      for (let i = 0; i < definitionCount; i++) {
        let fields = definitions[i].fields;
        for (let j = 0; j < fields.length; j++) {
          let field = fields[j];
          let type = field.type;
          if (type !== null && type < 0) {
            if (~type >= types.length) {
              throw new Error("Invalid type " + type);
            }
            field.type = types[~type];
          } else {
            if (type !== null && type >= definitions.length) {
              throw new Error("Invalid type " + type);
            }
            field.type = type === null ? null : definitions[type].name;
          }
        }
      }
      return {
        package: null,
        definitions
      };
    }
    function encodeBinarySchema2(schema) {
      let bb = new ByteBuffer();
      let definitions = schema.definitions;
      let definitionIndex = {};
      bb.writeVarUint(definitions.length);
      for (let i = 0; i < definitions.length; i++) {
        definitionIndex[definitions[i].name] = i;
      }
      for (let i = 0; i < definitions.length; i++) {
        let definition = definitions[i];
        bb.writeString(definition.name);
        bb.writeByte(kinds.indexOf(definition.kind));
        bb.writeVarUint(definition.fields.length);
        for (let j = 0; j < definition.fields.length; j++) {
          let field = definition.fields[j];
          let type = types.indexOf(field.type);
          bb.writeString(field.name);
          bb.writeVarInt(type === -1 ? definitionIndex[field.type] : ~type);
          bb.writeByte(field.isArray ? 1 : 0);
          bb.writeVarUint(field.value);
        }
      }
      return bb.toUint8Array();
    }
    var nativeTypes = [
      "bool",
      "byte",
      "float",
      "int",
      "int64",
      "string",
      "uint",
      "uint64"
    ];
    var reservedNames = [
      "ByteBuffer",
      "package"
    ];
    var regex = /((?:-|\b)\d+\b|[=;{}]|\[\]|\[deprecated\]|\b[A-Za-z_][A-Za-z0-9_]*\b|\/\/.*|\s+)/g;
    var identifier = /^[A-Za-z_][A-Za-z0-9_]*$/;
    var whitespace = /^\/\/.*|\s+$/;
    var equals = /^=$/;
    var endOfFile = /^$/;
    var semicolon = /^;$/;
    var integer = /^-?\d+$/;
    var leftBrace = /^\{$/;
    var rightBrace = /^\}$/;
    var arrayToken = /^\[\]$/;
    var enumKeyword = /^enum$/;
    var structKeyword = /^struct$/;
    var messageKeyword = /^message$/;
    var packageKeyword = /^package$/;
    var deprecatedToken = /^\[deprecated\]$/;
    function tokenize(text) {
      let parts = text.split(regex);
      let tokens = [];
      let column = 0;
      let line = 0;
      for (let i = 0; i < parts.length; i++) {
        let part = parts[i];
        if (i & 1) {
          if (!whitespace.test(part)) {
            tokens.push({
              text: part,
              line: line + 1,
              column: column + 1
            });
          }
        } else if (part !== "") {
          error("Syntax error " + quote(part), line + 1, column + 1);
        }
        let lines = part.split("\n");
        if (lines.length > 1)
          column = 0;
        line += lines.length - 1;
        column += lines[lines.length - 1].length;
      }
      tokens.push({
        text: "",
        line,
        column
      });
      return tokens;
    }
    function parse(tokens) {
      function current() {
        return tokens[index];
      }
      function eat(test) {
        if (test.test(current().text)) {
          index++;
          return true;
        }
        return false;
      }
      function expect(test, expected) {
        if (!eat(test)) {
          let token = current();
          error("Expected " + expected + " but found " + quote(token.text), token.line, token.column);
        }
      }
      function unexpectedToken() {
        let token = current();
        error("Unexpected token " + quote(token.text), token.line, token.column);
      }
      let definitions = [];
      let packageText = null;
      let index = 0;
      if (eat(packageKeyword)) {
        packageText = current().text;
        expect(identifier, "identifier");
        expect(semicolon, '";"');
      }
      while (index < tokens.length && !eat(endOfFile)) {
        let fields = [];
        let kind;
        if (eat(enumKeyword))
          kind = "ENUM";
        else if (eat(structKeyword))
          kind = "STRUCT";
        else if (eat(messageKeyword))
          kind = "MESSAGE";
        else
          unexpectedToken();
        let name = current();
        expect(identifier, "identifier");
        expect(leftBrace, '"{"');
        while (!eat(rightBrace)) {
          let type = null;
          let isArray = false;
          let isDeprecated = false;
          if (kind !== "ENUM") {
            type = current().text;
            expect(identifier, "identifier");
            isArray = eat(arrayToken);
          }
          let field = current();
          expect(identifier, "identifier");
          let value = null;
          if (kind !== "STRUCT") {
            expect(equals, '"="');
            value = current();
            expect(integer, "integer");
            if ((+value.text | 0) + "" !== value.text) {
              error("Invalid integer " + quote(value.text), value.line, value.column);
            }
          }
          let deprecated = current();
          if (eat(deprecatedToken)) {
            if (kind !== "MESSAGE") {
              error("Cannot deprecate this field", deprecated.line, deprecated.column);
            }
            isDeprecated = true;
          }
          expect(semicolon, '";"');
          fields.push({
            name: field.text,
            line: field.line,
            column: field.column,
            type,
            isArray,
            isDeprecated,
            value: value !== null ? +value.text | 0 : fields.length + 1
          });
        }
        definitions.push({
          name: name.text,
          line: name.line,
          column: name.column,
          kind,
          fields
        });
      }
      return {
        package: packageText,
        definitions
      };
    }
    function verify(root) {
      let definedTypes = nativeTypes.slice();
      let definitions = {};
      for (let i = 0; i < root.definitions.length; i++) {
        let definition = root.definitions[i];
        if (definedTypes.indexOf(definition.name) !== -1) {
          error("The type " + quote(definition.name) + " is defined twice", definition.line, definition.column);
        }
        if (reservedNames.indexOf(definition.name) !== -1) {
          error("The type name " + quote(definition.name) + " is reserved", definition.line, definition.column);
        }
        definedTypes.push(definition.name);
        definitions[definition.name] = definition;
      }
      for (let i = 0; i < root.definitions.length; i++) {
        let definition = root.definitions[i];
        let fields = definition.fields;
        if (definition.kind === "ENUM" || fields.length === 0) {
          continue;
        }
        for (let j = 0; j < fields.length; j++) {
          let field = fields[j];
          if (definedTypes.indexOf(field.type) === -1) {
            error("The type " + quote(field.type) + " is not defined for field " + quote(field.name), field.line, field.column);
          }
        }
        let values = [];
        for (let j = 0; j < fields.length; j++) {
          let field = fields[j];
          if (values.indexOf(field.value) !== -1) {
            error("The id for field " + quote(field.name) + " is used twice", field.line, field.column);
          }
          if (field.value <= 0) {
            error("The id for field " + quote(field.name) + " must be positive", field.line, field.column);
          }
          if (field.value > fields.length) {
            error("The id for field " + quote(field.name) + " cannot be larger than " + fields.length, field.line, field.column);
          }
          values.push(field.value);
        }
      }
      let state = {};
      let check = (name) => {
        let definition = definitions[name];
        if (definition && definition.kind === "STRUCT") {
          if (state[name] === 1) {
            error("Recursive nesting of " + quote(name) + " is not allowed", definition.line, definition.column);
          }
          if (state[name] !== 2 && definition) {
            state[name] = 1;
            let fields = definition.fields;
            for (let i = 0; i < fields.length; i++) {
              let field = fields[i];
              if (!field.isArray) {
                check(field.type);
              }
            }
            state[name] = 2;
          }
        }
        return true;
      };
      for (let i = 0; i < root.definitions.length; i++) {
        check(root.definitions[i].name);
      }
    }
    function parseSchema(text) {
      let schema = parse(tokenize(text));
      verify(schema);
      return schema;
    }
    function prettyPrintSchema(schema) {
      let definitions = schema.definitions;
      let text = "";
      if (schema.package !== null) {
        text += "package " + schema.package + ";\n";
      }
      for (let i = 0; i < definitions.length; i++) {
        let definition = definitions[i];
        if (i > 0 || schema.package !== null)
          text += "\n";
        text += definition.kind.toLowerCase() + " " + definition.name + " {\n";
        for (let j = 0; j < definition.fields.length; j++) {
          let field = definition.fields[j];
          text += "  ";
          if (definition.kind !== "ENUM") {
            text += field.type;
            if (field.isArray) {
              text += "[]";
            }
            text += " ";
          }
          text += field.name;
          if (definition.kind !== "STRUCT") {
            text += " = " + field.value;
          }
          if (field.isDeprecated) {
            text += " [deprecated]";
          }
          text += ";\n";
        }
        text += "}\n";
      }
      return text;
    }
  }
});
var import_kiwi_schema3 = __toESM2(require_kiwi2(), 1);
var import_kiwi_schema22 = __toESM2(require_kiwi2(), 1);
function nodeId2(node) {
  if (!node?.guid) return null;
  return `${node.guid.sessionID}:${node.guid.localID}`;
}
var IDENTITY_TRANSFORM = {
  m00: 1,
  m01: 0,
  m02: 0,
  m10: 0,
  m11: 1,
  m12: 0
};
function cloneTransform(transform) {
  if (!transform) return { ...IDENTITY_TRANSFORM };
  return {
    m00: transform.m00,
    m01: transform.m01,
    m02: transform.m02,
    m10: transform.m10,
    m11: transform.m11,
    m12: transform.m12
  };
}
function isRenderableGradientPaint(paint) {
  return !!paint && paint.visible !== false && (paint.type === "GRADIENT_LINEAR" || paint.type === "GRADIENT_RADIAL") && Array.isArray(paint.stops) && paint.stops.length > 0;
}
function extractRenderableGradientFill(paints) {
  const paint = paints?.find((entry) => isRenderableGradientPaint(entry));
  if (!paint) return null;
  return {
    type: paint.type === "GRADIENT_LINEAR" ? "linear" : "radial",
    opacity: paint.opacity ?? 1,
    transform: cloneTransform(paint.transform),
    stops: [...paint.stops].sort((a, b) => a.position - b.position).map((stop) => ({
      position: stop.position,
      color: { ...stop.color },
      colorVar: stop.colorVar
    }))
  };
}
function resolveGradientGeometry(fill2, width, height) {
  if (width <= 0 || height <= 0) return null;
  const transform = fill2.transform ?? IDENTITY_TRANSFORM;
  const { m00, m01, m02, m10, m11, m12 } = transform;
  const det = m00 * m11 - m10 * m01;
  if (Math.abs(det) < 1e-12) return null;
  const ia = m11 / det;
  const ic = -m01 / det;
  const ie = (m01 * m12 - m11 * m02) / det;
  const ib = -m10 / det;
  const iid = m00 / det;
  const iif = (m10 * m02 - m00 * m12) / det;
  const point = (gx, gy) => ({
    x: (ia * gx + ic * gy + ie) * width,
    y: (ib * gx + iid * gy + iif) * height
  });
  if (fill2.type === "linear") {
    return {
      type: "linear",
      start: point(0, 0.5),
      end: point(1, 0.5)
    };
  }
  const center = point(0.5, 0.5);
  const xAxisPoint = point(1, 0.5);
  const yAxisPoint = point(0.5, 1);
  return {
    type: "radial",
    center,
    radiusX: Math.hypot(xAxisPoint.x - center.x, xAxisPoint.y - center.y),
    radiusY: Math.hypot(yAxisPoint.x - center.x, yAxisPoint.y - center.y),
    angle: Math.atan2(xAxisPoint.y - center.y, xAxisPoint.x - center.x)
  };
}
function parseVectorNetworkBlob(bytes) {
  if (bytes.length < 12) {
    throw new Error(
      `vectorNetworkBlob too short: ${bytes.length} bytes, need at least 12 for header`
    );
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 0;
  const vertexCount = view.getUint32(offset, true);
  offset += 4;
  const segmentCount = view.getUint32(offset, true);
  offset += 4;
  const regionCount = view.getUint32(offset, true);
  offset += 4;
  const verticesEnd = 12 + vertexCount * 12;
  const segmentsEnd = verticesEnd + segmentCount * 28;
  if (verticesEnd > bytes.length) {
    throw new Error(
      `vertexCount ${vertexCount} runs past buffer: needs ${verticesEnd} bytes, have ${bytes.length}`
    );
  }
  if (segmentsEnd > bytes.length) {
    throw new Error(
      `segmentCount ${segmentCount} runs past buffer: needs ${segmentsEnd} bytes, have ${bytes.length}`
    );
  }
  const vertices = [];
  for (let i = 0; i < vertexCount; i++) {
    const styleID = view.getUint32(offset, true);
    offset += 4;
    const x = view.getFloat32(offset, true);
    offset += 4;
    const y = view.getFloat32(offset, true);
    offset += 4;
    vertices.push({ x, y, styleID });
  }
  const segments = [];
  for (let i = 0; i < segmentCount; i++) {
    const segmentOffset = offset;
    offset += 4;
    const startVertex = view.getUint32(offset, true);
    offset += 4;
    const tsx = view.getFloat32(offset, true);
    offset += 4;
    const tsy = view.getFloat32(offset, true);
    offset += 4;
    const endVertex = view.getUint32(offset, true);
    offset += 4;
    const tex = view.getFloat32(offset, true);
    offset += 4;
    const tey = view.getFloat32(offset, true);
    offset += 4;
    if (startVertex >= vertexCount) {
      throw new Error(
        `segment ${i} startVertex ${startVertex} out of range (vertexCount ${vertexCount}) at offset ${segmentOffset}`
      );
    }
    if (endVertex >= vertexCount) {
      throw new Error(
        `segment ${i} endVertex ${endVertex} out of range (vertexCount ${vertexCount}) at offset ${segmentOffset}`
      );
    }
    segments.push({
      start: { vertex: startVertex, dx: tsx, dy: tsy },
      end: { vertex: endVertex, dx: tex, dy: tey },
      isStraight: tsx === 0 && tsy === 0 && tex === 0 && tey === 0
    });
  }
  const regions = [];
  for (let r = 0; r < regionCount; r++) {
    if (offset + 8 > bytes.length) {
      throw new Error(
        `region ${r} header runs past buffer at offset ${offset} (have ${bytes.length} bytes)`
      );
    }
    const packed = view.getUint32(offset, true);
    offset += 4;
    const numLoops = view.getUint32(offset, true);
    offset += 4;
    const windingRule = packed & 1 ? "NONZERO" : "ODD";
    const styleID = packed >> 1;
    const loops = [];
    for (let l = 0; l < numLoops; l++) {
      if (offset + 4 > bytes.length) {
        throw new Error(
          `region ${r} loop ${l} segCount runs past buffer at offset ${offset} (have ${bytes.length} bytes)`
        );
      }
      const segCount = view.getUint32(offset, true);
      offset += 4;
      if (offset + segCount * 4 > bytes.length) {
        throw new Error(
          `region ${r} loop ${l} declares ${segCount} segment indices, runs past buffer at offset ${offset} (have ${bytes.length} bytes)`
        );
      }
      const loop = [];
      for (let s = 0; s < segCount; s++) {
        const segIndex = view.getUint32(offset, true);
        offset += 4;
        if (segIndex >= segmentCount) {
          throw new Error(
            `region ${r} loop ${l} segment index ${segIndex} out of range (segmentCount ${segmentCount})`
          );
        }
        loop.push(segIndex);
      }
      loops.push(loop);
    }
    regions.push({ windingRule, styleID, loops });
  }
  if (offset !== bytes.length) {
    throw new Error(
      `trailing bytes: parsed ${offset} bytes but buffer is ${bytes.length} bytes long`
    );
  }
  return { vertices, segments, regions, bytesConsumed: offset };
}
function hashToHex(arr) {
  return Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
}
var POSITION_FIRST = 33;
var POSITION_LAST = 125;
var POSITION_BASE = POSITION_LAST - POSITION_FIRST + 1;
var POSITION_MORE = String.fromCharCode(POSITION_LAST + 1);
var _svgIdSeq = 0;
var _symbolDepth = 0;
function cssColor(color2, opacity = 1) {
  const r = Math.round((color2.r ?? 0) * 255);
  const g = Math.round((color2.g ?? 0) * 255);
  const b = Math.round((color2.b ?? 0) * 255);
  const a = ((color2.a ?? 1) * opacity).toFixed(4);
  return `rgba(${r},${g},${b},${a})`;
}
function resolveFill(fillPaints) {
  if (!fillPaints?.length) return null;
  const p = fillPaints.find((p2) => p2.visible !== false && p2.type === "SOLID");
  if (!p) return null;
  return cssColor(p.color ?? {}, p.opacity ?? 1);
}
function resolveGradientSvg(paint, w, h) {
  const gradient = extractRenderableGradientFill([paint]);
  if (!gradient) return null;
  const geometry = resolveGradientGeometry(gradient, w, h);
  if (!geometry) return null;
  const id = `grad-${++_svgIdSeq}`;
  const stops = gradient.stops.map((s) => {
    const c = s.color ?? {};
    const r = Math.round((c.r ?? 0) * 255);
    const g = Math.round((c.g ?? 0) * 255);
    const b = Math.round((c.b ?? 0) * 255);
    const a = (c.a ?? 1).toFixed(4);
    return `<stop offset="${s.position}" stop-color="rgb(${r},${g},${b})" stop-opacity="${a}"/>`;
  }).join("");
  const opacityAttr = gradient.opacity !== 1 ? ` opacity="${gradient.opacity}"` : "";
  const f2 = (v) => +v.toFixed(2);
  if (geometry.type === "linear") {
    return {
      defs: `<linearGradient id="${id}" x1="${f2(geometry.start.x)}" y1="${f2(geometry.start.y)}" x2="${f2(geometry.end.x)}" y2="${f2(geometry.end.y)}" gradientUnits="userSpaceOnUse">${stops}</linearGradient>`,
      fill: `url(#${id})`,
      opacityAttr
    };
  }
  const cx = f2(geometry.center.x), cy = f2(geometry.center.y);
  const rx = f2(geometry.radiusX), ry = f2(geometry.radiusY);
  const angle = f2(geometry.angle * 180 / Math.PI);
  return {
    defs: `<radialGradient id="${id}" cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" gradientUnits="userSpaceOnUse" gradientTransform="rotate(${angle},${cx},${cy})">${stops}</radialGradient>`,
    fill: `url(#${id})`,
    opacityAttr
  };
}
function appendDefs(defs, extra) {
  if (!extra) return defs;
  return defs ? defs.replace("</defs>", `${extra}</defs>`) : `<defs>${extra}</defs>`;
}
function getFillPaints(node) {
  if (node.fillPaints?.length) return node.fillPaints;
  return node.nodeGenerationData?.overrides?.[0]?.fillPaints ?? null;
}
function strokeSpec(node) {
  if (!node.strokeWeight || node.strokeWeight === 0) return null;
  const color2 = resolveFill(node.strokePaints) ?? "none";
  if (color2 === "none") return null;
  return {
    color: color2,
    width: node.strokeWeight,
    align: node.strokeAlign ?? "CENTER"
  };
}
function strokeGeometrySvg(deck, node) {
  const strokeColor = resolveFill(node.strokePaints);
  const sw = node.strokeWeight ?? 0;
  const blobs = deck.message?.blobs;
  if (!strokeColor || sw <= 0 || !node.strokeGeometry?.length || !blobs) return "";
  const segments = [];
  let hasEvenOdd = false;
  for (const geo of node.strokeGeometry) {
    const d = decodeCmdBlob(blobs, geo.commandsBlob);
    if (d) segments.push(d);
    if ((geo.windingRule === "ODD" || geo.windingRule === "EVENODD")) hasEvenOdd = true;
  }
  if (!segments.length) return "";
  const rule = segments.length > 1 || hasEvenOdd ? ' fill-rule="evenodd"' : "";
  return `<path d="${segments.join("")}" fill="${strokeColor}"${rule}/>`;
}
function rectStrokeSvg(x, y, w, h, rx, stroke) {
  if (!stroke) return "";
  let sx = x;
  let sy = y;
  let sw = w;
  let sh = h;
  let srx = Math.min(rx, w / 2, h / 2);
  if (stroke.align === "INSIDE") {
    sx += stroke.width / 2;
    sy += stroke.width / 2;
    sw -= stroke.width;
    sh -= stroke.width;
    srx = Math.max(0, srx - stroke.width / 2);
  } else if (stroke.align === "OUTSIDE") {
    sx -= stroke.width / 2;
    sy -= stroke.width / 2;
    sw += stroke.width;
    sh += stroke.width;
    srx += stroke.width / 2;
  }
  if (sw <= 0 || sh <= 0) return "";
  return `<rect x="${sx}" y="${sy}" width="${sw}" height="${sh}" rx="${srx}" ry="${srx}" fill="none" stroke="${stroke.color}" stroke-width="${stroke.width}"/>`;
}
function ellipseStrokeSvg(cx, cy, rx, ry, stroke) {
  if (!stroke) return "";
  let srx = rx;
  let sry = ry;
  if (stroke.align === "INSIDE") {
    srx -= stroke.width / 2;
    sry -= stroke.width / 2;
  } else if (stroke.align === "OUTSIDE") {
    srx += stroke.width / 2;
    sry += stroke.width / 2;
  }
  if (srx <= 0 || sry <= 0) return "";
  return `<ellipse cx="${cx}" cy="${cy}" rx="${srx}" ry="${sry}" fill="none" stroke="${stroke.color}" stroke-width="${stroke.width}"/>`;
}
function svgTransform(node) {
  const t = node.transform;
  if (!t) return "translate(0,0)";
  const m00 = t.m00 ?? 1, m01 = t.m01 ?? 0, m02 = t.m02 ?? 0;
  const m10 = t.m10 ?? 0, m11 = t.m11 ?? 1, m12 = t.m12 ?? 0;
  if (Math.abs(m00 - 1) < 1e-6 && Math.abs(m01) < 1e-6 && Math.abs(m10) < 1e-6 && Math.abs(m11 - 1) < 1e-6) {
    return `translate(${m02},${m12})`;
  }
  const h = (v) => +v.toFixed(6);
  return `matrix(${h(m00)},${h(m10)},${h(m01)},${h(m11)},${f(m02)},${f(m12)})`;
}
function size(node) {
  return { w: node.size?.x ?? 0, h: node.size?.y ?? 0 };
}
function renderRect(deck, node) {
  const { w, h } = size(node);
  const radiiInfo = getNodeRadii(node);
  if (radiiInfo.independent) {
    const pathD = independentRoundedRectPath(0, 0, w, h, radiiInfo.radii);
    const fillColor = resolveFill(getFillPaints(node)) ?? "none";
    const fillSvg = fillColor !== "none" ? `<path d="${pathD}" fill="${fillColor}"/>` : "";
    const stroke = strokeSpec(node);
    const strokeSvg = stroke ? `<path d="${pathD}" fill="none" stroke="${stroke.color}" stroke-width="${stroke.width}"/>` : "";
    const inner = [fillSvg, strokeSvg].filter(Boolean).join("\n");
    return inner ? `<g transform="${svgTransform(node)}">\n${inner}\n</g>` : "";
  }
  const rx = Math.min(node.cornerRadius ?? 0, w / 2, h / 2);
  const { defs, bg } = renderRoundedRectFillStack(deck, getFillPaints(node), w, h, rx);
  const fillSvg = bg ? `${[defs, bg].filter(Boolean).join("\n")}` : "";
  const geoStroke = strokeGeometrySvg(deck, node);
  const strokeSvg = geoStroke || rectStrokeSvg(0, 0, w, h, rx, strokeSpec(node));
  const inner = geoStroke ? [strokeSvg, fillSvg].filter(Boolean).join("\n") : [fillSvg, strokeSvg].filter(Boolean).join("\n");
  if (!inner) return "";
  return `<g transform="${svgTransform(node)}">
${inner}
</g>`;
}
function renderEllipse(deck, node) {
  const { w, h } = size(node);
  const fill2 = resolveFill(getFillPaints(node)) ?? "none";
  const cx = w / 2;
  const cy = h / 2;
  const rx = w / 2;
  const ry = h / 2;
  const fillSvg = `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill2}"/>`;
  const geoStroke = strokeGeometrySvg(deck, node);
  const strokeSvg = geoStroke || ellipseStrokeSvg(cx, cy, rx, ry, strokeSpec(node));
  const inner = geoStroke ? [strokeSvg, fillSvg].filter(Boolean).join("\n") : [fillSvg, strokeSvg].filter(Boolean).join("\n");
  return `<g transform="${svgTransform(node)}">
${inner}
</g>`;
}
function resolveLineHeight(lh, fontSize) {
  if (!lh) return fontSize * 1.2;
  switch (lh.units) {
    case "RAW":
      return lh.value * fontSize;
    case "PERCENT":
      return lh.value / 100 * fontSize;
    case "PIXELS":
      return lh.value;
    default:
      return fontSize * 1.2;
  }
}
var _NARROW = new Set("iIlt.,:;!|'`\"()[]{}/\\".split(""));
var _WIDE = new Set("ABCDEFGHJKLNOPQRSTUVXYZmw".split(""));
var _XWIDE = new Set("MW@%".split(""));
function approxCharWidth(ch, fontSize) {
  if (ch === " ") return fontSize * 0.28;
  if (_NARROW.has(ch)) return fontSize * 0.28;
  if (_XWIDE.has(ch)) return fontSize * 0.85;
  if (_WIDE.has(ch)) return fontSize * 0.66;
  return fontSize * 0.52;
}
function approxTextWidth(str, fontSize, letterSpacingPx = 0) {
  let w = 0;
  for (let i = 0; i < str.length; i++) w += approxCharWidth(str[i], fontSize);
  if (str.length > 1) w += letterSpacingPx * (str.length - 1);
  return w;
}
function wrapLineByWidth(line, fontSize, maxWidth, letterSpacingPx = 0) {
  if (!line) return [line];
  if (!(maxWidth > 0)) return [line];
  if (approxTextWidth(line, fontSize, letterSpacingPx) <= maxWidth) return [line];
  const words = line.split(" ");
  const out = [];
  let cur = "";
  for (const word of words) {
    const candidate = cur ? cur + " " + word : word;
    if (approxTextWidth(candidate, fontSize, letterSpacingPx) <= maxWidth || !cur) {
      cur = candidate;
    } else {
      out.push(cur);
      cur = word;
    }
  }
  if (cur) out.push(cur);
  return out;
}
function esc(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function isStaleLayout(chars, baselines, glyphs) {
  if (!chars) return false;
  if (!baselines?.length && !glyphs?.length) return true;
  const len = chars.length;
  if (baselines?.length) {
    const lastEnd = baselines[baselines.length - 1]?.endCharacter;
    if (lastEnd != null && Math.abs(lastEnd - len) > 1) return true;
  }
  if (glyphs?.length) {
    const maxFirstChar = glyphs.reduce((max2, g) => Math.max(max2, g.firstCharacter ?? 0), 0);
    if (maxFirstChar >= len) return true;
    if (len > maxFirstChar + 3) return true;
  }
  return false;
}
function fallbackTextTspans(dispChars, fontSize, node, letterSpacingPx = 0) {
  const baselines = node.derivedTextData?.baselines;
  const rawLines = dispChars.split("\n");
  if (rawLines.length > 1 && !rawLines[rawLines.length - 1]) rawLines.pop();
  const lhFromNode = node.lineHeight ? resolveLineHeight(node.lineHeight, fontSize) : null;
  let lineHeightPx = baselines?.[0]?.lineHeight ?? lhFromNode ?? fontSize * 1.25;
  let lineAscent = baselines?.[0]?.lineAscent ?? fontSize * 0.8;
  const nodeW = node.size?.x ?? 1920;
  const nodeH = node.size?.y ?? 0;
  let scale = 1;
  if (baselines?.length) {
    const maxOrigCharsPerLine = Math.max(...baselines.map((b) => Math.max(0, (b.endCharacter ?? 0) - (b.firstCharacter ?? 0))));
    const maxNewCharsPerLine = Math.max(...rawLines.map((l) => l.length));
    if (maxNewCharsPerLine > maxOrigCharsPerLine && maxOrigCharsPerLine > 0) {
      scale = Math.min(scale, maxOrigCharsPerLine / maxNewCharsPerLine);
    }
    if (rawLines.length > baselines.length && nodeH > 0) {
      scale = Math.min(scale, baselines.length / rawLines.length);
    }
    scale = Math.max(scale, 0.15);
  }
  const adjFontSize = fontSize * scale;
  const adjLineHeight = lineHeightPx * scale;
  const adjLineAscent = lineAscent * scale;
  const adjLetterSpacingPx = letterSpacingPx * scale;
  const align = node.textAlignHorizontal ?? "LEFT";
  const anchor = align === "CENTER" ? "middle" : align === "RIGHT" ? "end" : "start";
  const anchorX = align === "CENTER" ? nodeW / 2 : align === "RIGHT" ? nodeW : 0;
  let startX, startY;
  if (baselines?.[0]?.position) {
    startX = align === "LEFT" ? baselines[0].position.x : anchorX;
    startY = baselines[0].position.y * scale;
  } else {
    startX = anchorX;
    const vAlign = node.textAlignVertical ?? "TOP";
    startY = adjLineAscent;
    if (vAlign !== "TOP") startY = null;
  }
  const lineType0 = null;
  const linesMeta = node.textData?.lines ?? [];
  const wrapped = [];
  for (let i = 0; i < rawLines.length; i++) {
    const rawLine = rawLines[i];
    const meta = linesMeta[i];
    const indent = (meta?.indentationLevel ?? 0) * adjFontSize * 0.8;
    const effectiveMaxW = Math.max(0, nodeW - indent);
    const pieces = wrapLineByWidth(rawLine, adjFontSize, effectiveMaxW, adjLetterSpacingPx);
    for (const piece of pieces) wrapped.push({ text: piece, metaIndex: i });
  }
  if (startY === null) {
    const totalH = wrapped.length * adjLineHeight;
    const nodeHH = node.size?.y ?? totalH;
    const vAlign = node.textAlignVertical ?? "TOP";
    startY = vAlign === "CENTER" ? (nodeHH - totalH) / 2 + adjLineAscent : vAlign === "BOTTOM" ? nodeHH - totalH + adjLineAscent : adjLineAscent;
  }
  let orderedCounter = 0;
  let lastMetaIdx = -1;
  const tspans = wrapped.map(({ text, metaIndex }, i) => {
    const y = startY + i * adjLineHeight;
    const meta = linesMeta[metaIndex];
    const lineType = meta?.lineType;
    const indent = (meta?.indentationLevel ?? 0) * adjFontSize * 0.8;
    let prefix = "";
    const isFirstVisualOfMeta = metaIndex !== lastMetaIdx;
    if (isFirstVisualOfMeta) {
      if (lineType === "UNORDERED_LIST") {
        prefix = "\u2022 ";
        orderedCounter = 0;
      } else if (lineType === "ORDERED_LIST") {
        orderedCounter++;
        prefix = `${orderedCounter}. `;
      } else {
        orderedCounter = 0;
      }
      lastMetaIdx = metaIndex;
    }
    const x = startX + indent;
    return `<tspan x="${x.toFixed(2)}" y="${y.toFixed(2)}" text-anchor="${anchor}">${esc(prefix + text) || " "}</tspan>`;
  }).join("");
  return { tspans, fontSize: adjFontSize };
}
function styleAttrsFromFontName(fontName, derivedFontWeight) {
  const style = fontName?.style ?? "Regular";
  const weight = derivedFontWeight ? String(derivedFontWeight) : /semibold/i.test(style) ? "600" : /bold/i.test(style) ? "700" : /medium/i.test(style) ? "500" : "400";
  const italic = /italic/i.test(style) ? "italic" : "normal";
  return { weight, italic };
}
function renderText(deck, node) {
  const outlines2 = deck.renderGlyphOutlines(node);
  if (outlines2 !== null) return outlines2;
  const chars = node.textData?.characters ?? "";
  if (!chars.trim()) return "";
  const dispChars = node.textCase === "UPPER" ? chars.toUpperCase() : node.textCase === "LOWER" ? chars.toLowerCase() : chars;
  let fontSize = node.derivedTextData?.glyphs?.[0]?.fontSize ?? node.fontSize ?? 24;
  const fontFamily = node.fontName?.family ?? "Inter";
  const fill2 = resolveFill(getFillPaints(node)) ?? "#000000";
  const ls = node.letterSpacing;
  let letterSpacingPx = !ls ? 0 : ls.units === "PERCENT" ? ls.value / 100 * fontSize : ls.units === "PIXELS" ? ls.value : 0;
  const baselines = node.derivedTextData?.baselines;
  const glyphs = node.derivedTextData?.glyphs;
  const styleIds = node.textData?.characterStyleIDs;
  const styleTable = node.textData?.styleOverrideTable;
  const stale = isStaleLayout(chars, baselines, glyphs);
  const styleMap = {};
  if (styleIds && styleTable) {
    for (const ov of styleTable) {
      const hasFontName = ov.fontName?.family || ov.fontName?.style;
      const { weight, italic } = hasFontName ? styleAttrsFromFontName(ov.fontName, null) : {};
      styleMap[ov.styleID] = {
        family: hasFontName ? ov.fontName?.family ?? fontFamily : null,
        weight: hasFontName ? weight : null,
        // null → fall through to defWeight
        italic: hasFontName ? italic : null,
        // null → fall through to defItalic
        decoration: ov.textDecoration === "UNDERLINE" ? "underline" : "none"
      };
    }
  }
  const { weight: defWeight, italic: defItalic } = styleAttrsFromFontName(
    node.fontName,
    node.derivedTextData?.fontMetaData?.[0]?.fontWeight
  );
  const LIGATURES = ["ffl", "ffi", "ff", "fi", "fl"];
  function ligatureAt(i) {
    for (const lig of LIGATURES) {
      if (dispChars.slice(i, i + lig.length) === lig) return lig.length;
    }
    return 0;
  }
  let tspans = "";
  if (stale || !glyphs?.length) {
    const origFontSize = fontSize;
    const fb = fallbackTextTspans(dispChars, fontSize, node, letterSpacingPx);
    tspans = fb.tspans;
    fontSize = fb.fontSize;
    if (origFontSize > 0) letterSpacingPx *= fontSize / origFontSize;
  } else if (baselines?.length && glyphs?.length && styleIds?.length) {
    for (const b of baselines) {
      const lineGlyphs = glyphs.filter((g) => g.firstCharacter >= b.firstCharacter && g.firstCharacter < b.endCharacter);
      if (!lineGlyphs.length) continue;
      const runs = [];
      let curRun = null;
      for (const g of lineGlyphs) {
        const sid = styleIds[g.firstCharacter] ?? 0;
        if (!curRun || sid !== curRun.sid) {
          curRun = { sid, glyphs: [] };
          runs.push(curRun);
        }
        curRun.glyphs.push(g);
      }
      for (const run of runs) {
        const st = styleMap[run.sid] ?? {};
        const w = st.weight ?? defWeight;
        const it = st.italic ?? defItalic;
        const fam = st.family ?? fontFamily;
        for (let gi = 0; gi < run.glyphs.length; gi++) {
          const g = run.glyphs[gi];
          const ligLen = ligatureAt(g.firstCharacter);
          const span = ligLen > 1 ? ligLen : 1;
          const endIdx = gi + span < run.glyphs.length ? run.glyphs[gi + span].firstCharacter : Math.min(run.glyphs[run.glyphs.length - 1].firstCharacter + 1, b.endCharacter);
          const slice = dispChars.slice(g.firstCharacter, endIdx).replace(/\n$/, "");
          if (!slice || /^\s+$/.test(slice)) continue;
          tspans += `<tspan x="${g.position.x}" y="${g.position.y}" font-family="${fam}, sans-serif" font-weight="${w}" font-style="${it}">${esc(slice)}</tspan>`;
          if (span > 1) gi += span - 1;
        }
      }
    }
  } else if (glyphs?.length) {
    for (let i = 0; i < glyphs.length; i++) {
      const g = glyphs[i];
      const ligLen = ligatureAt(g.firstCharacter);
      const span = ligLen > 1 ? ligLen : 1;
      const endIdx = i + span < glyphs.length ? glyphs[i + span].firstCharacter : chars.length;
      const slice = dispChars.slice(g.firstCharacter, endIdx).replace(/\n$/, "");
      if (!slice || /^\s+$/.test(slice)) {
        continue;
      }
      tspans += `<tspan x="${g.position.x}" y="${g.position.y}">${esc(slice)}</tspan>`;
      if (span > 1) i += span - 1;
    }
  } else if (baselines?.length) {
    tspans = baselines.map((b) => {
      const slice = dispChars.slice(b.firstCharacter, b.endCharacter).replace(/\n$/, "");
      return `<tspan x="${b.position.x}" y="${b.position.y}">${esc(slice) || " "}</tspan>`;
    }).join("");
  } else {
    throw new Error(`TEXT ${node.name ?? nodeId2(node)} is missing derived baselines`);
  }
  const lsAttr = letterSpacingPx === 0 ? "" : ` letter-spacing="${letterSpacingPx.toFixed(3)}"`;
  const textEl = [
    `<text font-size="${fontSize}" font-family="${fontFamily}, sans-serif"`,
    `  font-weight="${defWeight}" font-style="${defItalic}" fill="${fill2}"${lsAttr}`,
    `  text-rendering="geometricPrecision">${tspans}</text>`
  ].join("\n");
  const decorations = node.derivedTextData?.decorations ?? [];
  if (!decorations.length) return `<g transform="${svgTransform(node)}">
${textEl}
</g>`;
  const decorationRects = decorations.flatMap(
    (d) => (d.rects ?? []).map(
      (r) => `<rect x="${r.x.toFixed(2)}" y="${r.y.toFixed(2)}" width="${r.w.toFixed(2)}" height="${r.h.toFixed(2)}" fill="${fill2}"/>`
    )
  );
  const inner = decorationRects.length ? textEl + "\n" + decorationRects.join("\n") : textEl;
  return `<g transform="${svgTransform(node)}">
${inner}
</g>`;
}
function resolveImageFillSvg(deck, imgFill, w, h, rx) {
  const hashBytes = imgFill.image?.hash;
  const hash = hashBytes?.length ? hashToHex(hashBytes) : imgFill.image?.name;
  if (!hash) throw new Error("Visible IMAGE fill is missing its asset hash");
  if (!deck.imagesDir) throw new Error(`Deck is missing imagesDir for visible IMAGE fill ${hash}`);
  let buf;
  try {
    buf = deck.readImage(hash);
  } catch (err3) {
    throw new Error(`Missing image fill asset ${hash} in ${deck.imagesDir}: ${err3.message}`);
  }
  const mime = buf[0] === 255 && buf[1] === 216 ? "image/jpeg" : "image/png";
  const dataUri = `data:${mime};base64,${buf.toString("base64")}`;
  const id = ++_svgIdSeq;
  const clipId = `img-clip-${id}`;
  const clipDef = `<clipPath id="${clipId}"><rect width="${w}" height="${h}" rx="${rx}" ry="${rx}"/></clipPath>`;
  const mode = imgFill.imageScaleMode ?? "FILL";
  const opacityAttr = (imgFill.opacity ?? 1) !== 1 ? ` opacity="${imgFill.opacity}"` : "";
  if (mode === "TILE") {
    const tw = (imgFill.originalImageWidth ?? 100) * (imgFill.scale ?? 1);
    const th = (imgFill.originalImageHeight ?? 100) * (imgFill.scale ?? 1);
    const patId = `img-pat-${id}`;
    return {
      defs: `${clipDef}<pattern id="${patId}" x="0" y="0" width="${tw}" height="${th}" patternUnits="userSpaceOnUse"><image href="${dataUri}" width="${tw}" height="${th}"${opacityAttr}/></pattern>`,
      bg: `<rect x="0" y="0" width="${w}" height="${h}" rx="${rx}" ry="${rx}" fill="url(#${patId})" clip-path="url(#${clipId})"/>`
    };
  }
  if (mode === "STRETCH") {
    const t = imgFill.transform;
    const ow = imgFill.originalImageWidth ?? 0;
    const oh = imgFill.originalImageHeight ?? 0;
    const axisAligned = t && Math.abs(t.m01 ?? 0) < 1e-9 && Math.abs(t.m10 ?? 0) < 1e-9 && t.m00 > 0 && t.m11 > 0 && ow > 0 && oh > 0;
    if (axisAligned) {
      const cropX = t.m02 * ow;
      const cropY = t.m12 * oh;
      const cropW = t.m00 * ow;
      const cropH = t.m11 * oh;
      const scaleX = w / cropW;
      const scaleY = h / cropH;
      return {
        defs: clipDef,
        bg: `<image href="${dataUri}" x="${-cropX * scaleX}" y="${-cropY * scaleY}" width="${ow * scaleX}" height="${oh * scaleY}" preserveAspectRatio="none" clip-path="url(#${clipId})"${opacityAttr}/>`
      };
    }
  }
  const par = mode === "FIT" ? "xMidYMid meet" : "xMidYMid slice";
  return {
    defs: clipDef,
    bg: `<image href="${dataUri}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="${par}" clip-path="url(#${clipId})"${opacityAttr}/>`
  };
}
function renderRoundedRectFillStack(deck, fillPaints, w, h, rx) {
  const visibleFills = fillPaints?.filter((p) => p.visible !== false) ?? [];
  let defs = "";
  const bgParts = [];
  for (const fill2 of visibleFills) {
    if (fill2.type === "SOLID") {
      bgParts.push(`<rect x="0" y="0" width="${w}" height="${h}" rx="${rx}" ry="${rx}" fill="${cssColor(fill2.color ?? {}, fill2.opacity ?? 1)}"/>`);
      continue;
    }
    if (fill2.type === "IMAGE") {
      const result = resolveImageFillSvg(deck, fill2, w, h, rx);
      defs = appendDefs(defs, result.defs);
      bgParts.push(result.bg);
      continue;
    }
    if (fill2.type === "GRADIENT_LINEAR" || fill2.type === "GRADIENT_RADIAL") {
      const grad = resolveGradientSvg(fill2, w, h);
      if (grad) {
        defs = appendDefs(defs, grad.defs);
        bgParts.push(`<rect x="0" y="0" width="${w}" height="${h}" rx="${rx}" ry="${rx}" fill="${grad.fill}"${grad.opacityAttr}/>`);
      }
    }
  }
  return { defs, bg: bgParts.join("\n") };
}
function renderFrame(deck, node) {
  const { w, h } = size(node);
  const rx = Math.min(node.cornerRadius ?? 0, w / 2, h / 2);
  const stroke = strokeSpec(node);
  const inner = childrenSvg(deck, node);
  let { defs, bg } = renderRoundedRectFillStack(deck, getFillPaints(node), w, h, rx);
  const hasFill = getFillPaints(node)?.some((p) => p.visible !== false);
  let clippedInner = inner;
  if (inner && node.frameMaskDisabled === false && _symbolDepth === 0 && hasFill) {
    const clipId = `frame-clip-${++_svgIdSeq}`;
    defs += `<clipPath id="${clipId}"><rect width="${w}" height="${h}" rx="${rx}" ry="${rx}"/></clipPath>`;
    clippedInner = `<g clip-path="url(#${clipId})">${inner}</g>`;
  }
  const strokeSvg = frameStrokeSvgFast(node, w, h, rx, stroke);
  const parts = [defs, bg, clippedInner, strokeSvg].filter(Boolean).join("\n");
  if (!parts) return "";
  return `<g transform="${svgTransform(node)}">
${parts}
</g>`;
}
function renderGroup(deck, node) {
  const inner = childrenSvg(deck, node);
  if (!inner) return "";
  return `<g transform="${svgTransform(node)}">
${inner}
</g>`;
}
function renderShapeWithText(deck, node) {
  const { w, h } = size(node);
  const genOvs = node.nodeGenerationData?.overrides ?? [];
  const shapeOv = genOvs[0] ?? {};
  const textOv = genOvs[1] ?? {};
  const rawRx = shapeOv.cornerRadius ?? 0;
  const rx = Math.min(rawRx, w / 2, h / 2);
  const fill2 = resolveFill(shapeOv.fillPaints) ?? "none";
  const geoStroke = strokeGeometrySvg(deck, node);
  let strokeAttr = "";
  if (!geoStroke) {
    const sw = shapeOv.strokeWeight ?? 0;
    const stroke = sw > 0 ? resolveFill(shapeOv.strokePaints) ?? "none" : "none";
    strokeAttr = sw > 0 && stroke !== "none" ? `stroke="${stroke}" stroke-width="${sw}"` : "";
  }
  const fillSvg = `<rect x="0" y="0" width="${w}" height="${h}" rx="${rx}" ry="${rx}" fill="${fill2}" ${strokeAttr}/>`;
  const rectSvg = geoStroke ? `${geoStroke}
${fillSvg}` : fillSvg;
  const chars = textOv.textData?.characters ?? "";
  if (!chars.trim()) return `<g transform="${svgTransform(node)}">${rectSvg}</g>`;
  const textCase = textOv.textCase ?? "ORIGINAL";
  const dispChars = textCase === "UPPER" ? chars.toUpperCase() : textCase === "LOWER" ? chars.toLowerCase() : chars;
  const derivedOvs = node.derivedImmutableFrameData?.overrides ?? [];
  const textDerived = derivedOvs.find((o) => o.derivedTextData) ?? {};
  const textBoxX = textDerived.transform?.m02 ?? 0;
  const textBoxY = textDerived.transform?.m12 ?? 0;
  const derivedText = textDerived.derivedTextData ?? {};
  const glyphs = derivedText.glyphs;
  const truncationStartIndex = derivedText.truncationStartIndex >= 0 ? derivedText.truncationStartIndex : null;
  const swtStale = isStaleLayout(chars, derivedText.baselines, glyphs);
  if (!glyphs?.length && !swtStale) {
    throw new Error(`SHAPE_WITH_TEXT ${node.name ?? nodeId2(node)} is missing derived glyph layout`);
  }
  const derivedFont = textDerived.derivedTextData?.fontMetaData?.[0]?.key;
  const fontSize = textDerived.derivedTextData?.glyphs?.[0]?.fontSize ?? textOv.fontSize ?? 24;
  const fontFamily = derivedFont?.family ?? textOv.fontName?.family ?? "Inter";
  const fontStyle = derivedFont?.style ?? textOv.fontName?.style ?? "Regular";
  const fontWeight = /semibold|bold/i.test(fontStyle) ? "bold" : /medium/i.test(fontStyle) ? "500" : "normal";
  const fontItalic = /italic/i.test(fontStyle) ? "italic" : "normal";
  const textFill = resolveFill(textOv.fillPaints) ?? "#000000";
  let tspan;
  if (swtStale || !glyphs?.length) {
    const swtBaselines = derivedText.baselines;
    const lineHeightPx = swtBaselines?.[0]?.lineHeight ?? fontSize * 1.2;
    const lineAscent = swtBaselines?.[0]?.lineAscent ?? fontSize * 0.8;
    const lines = dispChars.split("\n").filter((l, i, a) => i < a.length - 1 || l);
    const totalH = lines.length * lineHeightPx;
    const textBoxH = textDerived.size?.y ?? h;
    const startY = textBoxY + (textBoxH - totalH) / 2 + lineAscent;
    const textBoxW = textDerived.size?.x ?? w;
    const cx = textBoxX + textBoxW / 2;
    tspan = lines.map((line, i) => {
      const y = startY + i * lineHeightPx;
      return `<tspan x="${cx}" y="${y.toFixed(2)}" text-anchor="middle">${esc(line) || " "}</tspan>`;
    }).join("");
  } else {
    const spans = [];
    for (let i = 0; i < glyphs.length; i++) {
      const g = glyphs[i];
      if (truncationStartIndex != null && g.firstCharacter != null && g.firstCharacter >= truncationStartIndex) continue;
      let slice = "";
      let stopAfter = false;
      if (g.firstCharacter == null) {
        if (truncationStartIndex == null) continue;
        slice = "\u2026";
        stopAfter = true;
      } else {
        let nextChar = null;
        for (let j = i + 1; j < glyphs.length; j++) {
          const fc = glyphs[j].firstCharacter;
          if (fc != null && fc > g.firstCharacter) {
            nextChar = fc;
            break;
          }
        }
        slice = dispChars.slice(g.firstCharacter, nextChar ?? g.firstCharacter + 1);
      }
      if (!slice) continue;
      spans.push(`<tspan x="${textBoxX + g.position.x}" y="${textBoxY + g.position.y}">${esc(slice)}</tspan>`);
      if (stopAfter) break;
    }
    tspan = spans.join("");
  }
  const textSvg = [
    `<text font-size="${fontSize}" font-family="${fontFamily}, sans-serif"`,
    `  font-weight="${fontWeight}" font-style="${fontItalic}" fill="${textFill}"`,
    `  text-rendering="geometricPrecision">${tspan}</text>`
  ].join("\n");
  return `<g transform="${svgTransform(node)}">
${rectSvg}
${textSvg}
</g>`;
}
function renderLine(deck, node) {
  const geoSvg = strokeGeometrySvg(deck, node);
  if (geoSvg) {
    return `<g transform="${svgTransform(node)}">
${geoSvg}
</g>`;
  }
  const x1 = node.transform?.m02 ?? 0;
  const y1 = node.transform?.m12 ?? 0;
  const m00 = node.transform?.m00 ?? 1;
  const m10 = node.transform?.m10 ?? 0;
  const len = node.size?.x ?? 0;
  const x2 = x1 + len * m00;
  const y2 = y1 + len * m10;
  const stroke = resolveFill(node.strokePaints) ?? "#000000";
  const sw = node.strokeWeight ?? 1;
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${sw}"/>`;
}
function renderVector(deck, node) {
  const t = node.transform ?? {};
  const m00 = t.m00 ?? 1, m01 = t.m01 ?? 0, m02 = t.m02 ?? 0;
  const m10 = t.m10 ?? 0, m11 = t.m11 ?? 1, m12 = t.m12 ?? 0;
  const blobs = deck.message?.blobs;
  const parts = [];
  const fillColor = resolveFill(getFillPaints(node));
  const fillEntries = [];
  if (node.fillGeometry?.length && blobs) {
    const styleMap = /* @__PURE__ */ new Map();
    if (node.vectorData?.styleOverrideTable?.length) {
      for (const s of node.vectorData.styleOverrideTable) {
        if (s.styleID != null && s.fillPaints) {
          styleMap.set(s.styleID, resolveFill(s.fillPaints));
        }
      }
    }
    for (const geo of node.fillGeometry) {
      const color2 = geo.styleID && styleMap.has(geo.styleID) ? styleMap.get(geo.styleID) : fillColor;
      if (!color2) continue;
      const d = decodeCmdBlob(blobs, geo.commandsBlob);
      if (!d) continue;
      const rule = (geo.windingRule === "ODD" || geo.windingRule === "EVENODD") ? ' fill-rule="evenodd"' : "";
      fillEntries.push({ d, color: color2, rule });
    }
  }
  const strokeColor = resolveFill(node.strokePaints);
  const sw = node.strokeWeight ?? 0;
  const strokeAlign = node.strokeAlign ?? "CENTER";
  const dashAttr = Array.isArray(node.dashPattern) && node.dashPattern.length ? ` stroke-dasharray="${node.dashPattern.join(" ")}"` : "";
  const lineCap = node.strokeCap === "ROUND" ? "round" : node.strokeCap === "SQUARE" ? "square" : "butt";
  const lineJoin = node.strokeJoin === "ROUND" ? "round" : node.strokeJoin === "BEVEL" ? "bevel" : "miter";
  if (strokeAlign === "OUTSIDE" && strokeColor && sw > 0 && fillEntries.length) {
    for (const { d, rule } of fillEntries) {
      parts.push(
        `<path d="${d}" fill="none" stroke="${strokeColor}" stroke-width="${sw * 2}" stroke-linecap="${lineCap}" stroke-linejoin="${lineJoin}"${dashAttr}${rule}/>`
      );
    }
    for (const { d, color: color2, rule } of fillEntries) {
      parts.push(`<path d="${d}" fill="${color2}"${rule}/>`);
    }
  } else {
    for (const { d, color: color2, rule } of fillEntries) {
      parts.push(`<path d="${d}" fill="${color2}"${rule}/>`);
    }
    if (strokeColor && sw > 0 && node.strokeGeometry?.length && blobs) {
      const segments = [];
      let hasEvenOdd = false;
      for (const geo of node.strokeGeometry) {
        const d = decodeCmdBlob(blobs, geo.commandsBlob);
        if (d) segments.push(d);
        if ((geo.windingRule === "ODD" || geo.windingRule === "EVENODD")) hasEvenOdd = true;
      }
      if (segments.length) {
        const rule = segments.length > 1 || hasEvenOdd ? ' fill-rule="evenodd"' : "";
        parts.push(`<path d="${segments.join("")}" fill="${strokeColor}"${rule}/>`);
      }
    }
  }
  if (!parts.length && node.vectorData?.vectorNetworkBlob != null && blobs) {
    const vnbD = decodeVnb(blobs, node.vectorData.vectorNetworkBlob, node.vectorData.normalizedSize, node.size);
    if (vnbD) {
      if (!fillColor && strokeColor && sw > 0) {
        parts.push(
          `<path d="${vnbD}" fill="none" stroke="${strokeColor}" stroke-width="${sw}" stroke-linecap="${lineCap}" stroke-linejoin="${lineJoin}"${dashAttr}/>`
        );
      } else {
        const color2 = fillColor ?? strokeColor ?? "#000000";
        parts.push(`<path d="${vnbD}" fill="${color2}" fill-rule="evenodd"/>`);
      }
    }
  }
  if (!parts.length) return renderPlaceholder(deck, node);
  return `<g transform="matrix(${m00},${m10},${m01},${m11},${m02},${m12})">
${parts.join("\n")}
</g>`;
}
function renderBooleanOp(deck, node) {
  const ownSvg = renderVector(deck, node);
  let inner = "";
  if (node.booleanOperation === "UNION") {
    const parentFill = resolveFill(getFillPaints(node));
    if (parentFill) {
      const children = deck.getChildren(nodeId2(node));
      const childParts = [];
      for (const child of children) {
        if (child.phase === "REMOVED") continue;
        const origFills = child.fillPaints;
        child.fillPaints = getFillPaints(node);
        childParts.push(renderNode(deck, child));
        child.fillPaints = origFills;
      }
      inner = childParts.filter(Boolean).join("\n");
    }
  }
  if (!ownSvg && !inner) return "";
  if (!inner) return ownSvg;
  if (!ownSvg) {
    const t = node.transform ?? {};
    const m00 = t.m00 ?? 1, m01 = t.m01 ?? 0, m02 = t.m02 ?? 0;
    const m10 = t.m10 ?? 0, m11 = t.m11 ?? 1, m12 = t.m12 ?? 0;
    return `<g transform="matrix(${m00},${m10},${m01},${m11},${m02},${m12})">
${inner}
</g>`;
  }
  const closeIdx = ownSvg.lastIndexOf("</g>");
  return ownSvg.slice(0, closeIdx) + inner + "\n</g>";
}
function decodeCmdBlob(blobs, blobIdx) {
  return decodeCmdBlobFast(blobs, blobIdx);
}
function f(v) {
  return +v.toFixed(4);
}
function decodeVnb(blobs, blobIdx, normalizedSize, nodeSize) {
  const buf = blobToBuffer(blobs, blobIdx);
  if (!buf) return null;
  let network;
  try {
    network = parseVectorNetworkBlob(new Uint8Array(buf));
  } catch {
    return null;
  }
  const scaleX = (nodeSize?.x ?? 1) / (normalizedSize?.x ?? 1);
  const scaleY = (nodeSize?.y ?? 1) / (normalizedSize?.y ?? 1);
  const verts = network.vertices.map((v) => ({ x: v.x * scaleX, y: v.y * scaleY }));
  const segs = network.segments.map((s) => ({
    sv: s.start.vertex,
    ev: s.end.vertex,
    tsx: s.start.dx * scaleX,
    tsy: s.start.dy * scaleY,
    tex: s.end.dx * scaleX,
    tey: s.end.dy * scaleY,
    isStraight: s.isStraight
  }));
  const segToPathCmd = (seg, start, end) => {
    if (seg.isStraight) return `L${f(end.x)},${f(end.y)}`;
    const c1x = start.x + seg.tsx;
    const c1y = start.y + seg.tsy;
    const c2x = end.x + seg.tex;
    const c2y = end.y + seg.tey;
    return `C${f(c1x)},${f(c1y)} ${f(c2x)},${f(c2y)} ${f(end.x)},${f(end.y)}`;
  };
  const cmds = [];
  for (const region of network.regions) {
    for (const loop of region.loops) {
      loop.forEach((segIdx, s) => {
        const seg = segs[segIdx];
        if (!seg) return;
        const start = verts[seg.sv];
        const end = verts[seg.ev];
        if (!start || !end) return;
        if (s === 0) cmds.push(`M${f(start.x)},${f(start.y)}`);
        cmds.push(segToPathCmd(seg, start, end));
      });
      cmds.push("Z");
    }
  }
  if (!cmds.length && segs.length) {
    let currentEnd = null;
    let subpathStart = null;
    for (const seg of segs) {
      const start = verts[seg.sv];
      const end = verts[seg.ev];
      if (!start || !end) continue;
      if (currentEnd == null || seg.sv !== currentEnd) {
        cmds.push(`M${f(start.x)},${f(start.y)}`);
        subpathStart = seg.sv;
      }
      cmds.push(segToPathCmd(seg, start, end));
      if (subpathStart != null && seg.ev === subpathStart) {
        cmds.push("Z");
        currentEnd = null;
        subpathStart = null;
      } else {
        currentEnd = seg.ev;
      }
    }
  }
  return cmds.length ? cmds.join("") : null;
}
function blobToBuffer(blobs, blobIdx) {
  return toUint8Array(blobs?.[blobIdx]);
}
function renderPlaceholder(deck, node) {
  deck.reportPlaceholder?.(node);
  const { w, h } = size(node);
  const type = node.type ?? "?";
  return `<g transform="${svgTransform(node)}"><rect x="0" y="0" width="${w || 40}" height="${h || 40}" fill="none" stroke="#ff00ff" stroke-width="2" stroke-dasharray="6" opacity="0.5"/><!-- ${type} --></g>`;
}
function renderInstance(deck, node) {
  const symbolId = node.symbolData?.symbolID;
  if (!symbolId) return renderPlaceholder(deck, node);
  const symNid = `${symbolId.sessionID}:${symbolId.localID}`;
  const symbol = deck.getNode(symNid);
  if (!symbol) return renderPlaceholder(deck, node);
  if (symbol.componentKey && symbol.variantPropSpecs) {
    const specValues = new Set(symbol.variantPropSpecs.map((s) => s.value));
    const nameValues = (symbol.name || "").split(", ").map((p) => p.split("=")[1]).filter(Boolean);
    const invalid = nameValues.some((v) => !specValues.has(v));
    if (invalid) {
      const nid = `${node.guid.sessionID}:${node.guid.localID}`;
      console.warn(`\u26A0\uFE0F  Skipping INSTANCE ${nid}: symbol ${symNid} "${symbol.name}" has invalid variant specs \u2014 Figma would show blank`);
      return renderPlaceholder(deck, node);
    }
  }
  const overrides = node.symbolData?.symbolOverrides ?? [];
  const restores = [];
  const okMap = /* @__PURE__ */ new Map();
  function buildOkMap(nid) {
    for (const child of deck.getChildren(nid)) {
      const ok = child.overrideKey;
      if (ok) okMap.set(`${ok.sessionID}:${ok.localID}`, child);
      buildOkMap(`${child.guid.sessionID}:${child.guid.localID}`);
    }
  }
  buildOkMap(symNid);
  const dsdMap = /* @__PURE__ */ new Map();
  for (const entry of node.derivedSymbolData ?? []) {
    const guids = entry.guidPath?.guids;
    if (!guids?.length) continue;
    const g = guids[guids.length - 1];
    dsdMap.set(`${g.sessionID}:${g.localID}`, entry);
  }
  for (const ov of overrides) {
    const guids = ov.guidPath?.guids;
    if (!guids?.length) continue;
    const leafGuid = guids[guids.length - 1];
    const targetId = `${leafGuid.sessionID}:${leafGuid.localID}`;
    const target = deck.getNode(targetId) ?? okMap.get(targetId);
    if (!target) continue;
    if (ov.overriddenSymbolID && target.symbolData) {
      const origSymbolID = target.symbolData.symbolID;
      restores.push(() => {
        target.symbolData.symbolID = origSymbolID;
      });
      target.symbolData.symbolID = ov.overriddenSymbolID;
      const newSymNid = `${ov.overriddenSymbolID.sessionID}:${ov.overriddenSymbolID.localID}`;
      buildOkMap(newSymNid);
    }
    if (ov.textData?.characters != null && target.textData) {
      const origChars = target.textData.characters;
      const origDerived = target.derivedTextData;
      restores.push(() => {
        target.textData.characters = origChars;
        target.derivedTextData = origDerived;
      });
      target.textData.characters = ov.textData.characters;
      if (ov.textData.characters !== origChars) {
        target.derivedTextData = void 0;
      }
    }
    if (ov.fillPaints) {
      const origFill = target.fillPaints;
      restores.push(() => {
        target.fillPaints = origFill;
      });
      target.fillPaints = ov.fillPaints;
    }
    if (ov.visible !== undefined) {
      const origVis = target.visible;
      restores.push(() => {
        target.visible = origVis;
      });
      target.visible = ov.visible;
    }
    if (ov.opacity !== undefined) {
      const origOp = target.opacity;
      restores.push(() => {
        target.opacity = origOp;
      });
      target.opacity = ov.opacity;
    }
  }
  const isAutoLayout = !!symbol.stackMode;
  for (const [dsdId, dsd] of dsdMap) {
    const target = deck.getNode(dsdId) ?? okMap.get(dsdId);
    if (!target) continue;
    if (dsd.derivedTextData) {
      const orig = target.derivedTextData;
      restores.push(() => {
        target.derivedTextData = orig;
      });
      target.derivedTextData = dsd.derivedTextData;
    }
    if (isAutoLayout && dsd.size) {
      const orig = target.size;
      restores.push(() => {
        target.size = orig;
      });
      target.size = dsd.size;
    }
    if (isAutoLayout && dsd.transform) {
      const orig = target.transform;
      restores.push(() => {
        target.transform = orig;
      });
      target.transform = dsd.transform;
    }
  }
  const instSize = size(node);
  const symSize = size(symbol.size ? symbol : node);
  const sx = symSize.w ? instSize.w / symSize.w : 1;
  const sy = symSize.h ? instSize.h / symSize.h : 1;
  const needsScale = !isAutoLayout && (Math.abs(sx - 1) > 1e-3 || Math.abs(sy - 1) > 1e-3);
  const bgW = isAutoLayout ? instSize.w : symSize.w;
  const bgH = isAutoLayout ? instSize.h : symSize.h;
  const rx = Math.min(symbol.cornerRadius ?? 0, bgW / 2, bgH / 2);
  let { defs, bg } = renderRoundedRectFillStack(deck, getFillPaints(symbol), bgW, bgH, rx);
  let strokeSvg = "";
  const strokeSrc = node.strokePaints ? node : symbol;
  const strokeColor = resolveFill(strokeSrc.strokePaints);
  if (strokeColor && (strokeSrc.strokeWeight ?? 0) > 0) {
    if (strokeSrc.borderStrokeWeightsIndependent && strokeSrc.strokeGeometry?.length) {
      const blobs = deck.message?.blobs;
      if (blobs) {
        const segs = [];
        for (const geo of strokeSrc.strokeGeometry) {
          const d = decodeCmdBlob(blobs, geo.commandsBlob);
          if (d) segs.push(d);
        }
        if (segs.length) {
          const scId = `stroke-clip-${++_svgIdSeq}`;
          strokeSvg = `<clipPath id="${scId}"><rect width="${bgW}" height="${bgH}"/></clipPath><path d="${segs.join("")}" fill="${strokeColor}" clip-path="url(#${scId})"/>`;
        }
      }
    } else {
      const stroke = strokeSpec(strokeSrc);
      strokeSvg = rectStrokeSvg(0, 0, bgW, bgH, rx, stroke);
    }
  }
  _symbolDepth++;
  const inner = childrenSvg(deck, symbol);
  _symbolDepth--;
  for (const fn of restores) fn();
  let content = [defs, bg, inner, strokeSvg].filter(Boolean).join("\n");
  if (!content) return "";
  if (needsScale) {
    content = `<g transform="scale(${sx},${sy})">
${content}
</g>`;
  }
  return `<g transform="${svgTransform(node)}">
${content}
</g>`;
}
var RENDERERS = {
  ROUNDED_RECTANGLE: renderRect,
  RECTANGLE: renderRect,
  SHAPE_WITH_TEXT: renderShapeWithText,
  ELLIPSE: renderEllipse,
  TEXT: renderText,
  FRAME: renderFrame,
  GROUP: renderGroup,
  SECTION: renderGroup,
  BOOLEAN_OPERATION: renderBooleanOp,
  VECTOR: renderVector,
  LINE: renderLine,
  STAR: renderVector,
  REGULAR_POLYGON: renderVector,
  POLYGON: renderVector,
  INSTANCE: renderInstance
};
function buildEffectFilter(node) {
  const effects = node.effects?.filter((e) => e.visible !== false);
  if (!effects?.length) return null;
  const shadows = effects.filter((e) => e.type === "DROP_SHADOW");
  if (!shadows.length) return null;
  const id = `fx-${++_svgIdSeq}`;
  const parts = [];
  const mergeNodes = [];
  for (let i = 0; i < shadows.length; i++) {
    const s = shadows[i];
    const c = s.color ?? {};
    const r = Math.round((c.r ?? 0) * 255);
    const g = Math.round((c.g ?? 0) * 255);
    const b = Math.round((c.b ?? 0) * 255);
    const a = (c.a ?? 1).toFixed(4);
    const dx = s.offset?.x ?? 0;
    const dy = s.offset?.y ?? 0;
    const stdDev = (s.radius ?? 0) / 2;
    const sid = `s${i}`;
    parts.push(
      `<feGaussianBlur in="SourceAlpha" stdDeviation="${stdDev}" result="${sid}b"/>`,
      `<feOffset in="${sid}b" dx="${dx}" dy="${dy}" result="${sid}o"/>`,
      `<feFlood flood-color="rgb(${r},${g},${b})" flood-opacity="${a}" result="${sid}c"/>`,
      `<feComposite in="${sid}c" in2="${sid}o" operator="in" result="${sid}"/>`
    );
    mergeNodes.push(`<feMergeNode in="${sid}"/>`);
  }
  mergeNodes.push(`<feMergeNode in="SourceGraphic"/>`);
  parts.push(`<feMerge>${mergeNodes.join("")}</feMerge>`);
  const defs = `<filter id="${id}" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB">${parts.join("")}</filter>`;
  return { defs, attr: `filter="url(#${id})"` };
}
function renderNode(deck, node) {
  if (node.phase === "REMOVED" || node.visible === false) return "";
  deck.visit(node);
  const fn = RENDERERS[node.type] ?? renderPlaceholder;
  let svg = fn(deck, node);
  if (!svg) return "";
  const fx = buildEffectFilter(node);
  if (fx) {
    svg = `<defs>${fx.defs}</defs>
<g ${fx.attr}>${svg}</g>`;
  }
  const op = node.opacity;
  if (op != null && op < 1) {
    svg = `<g opacity="${op}">${svg}</g>`;
  }
  return svg;
}
function childrenSvg(deck, node) {
  const out = [];
  let activeMask = null;
  let masked = [];
  const flushMask = () => {
    if (!activeMask) return;
    const body = masked.filter(Boolean).join("\n");
    if (body) {
      const id = `alpha-mask-${++_svgIdSeq}`;
      const maskStyle = activeMask.maskType === "LUMINANCE" ? "luminance" : "alpha";
      const maskSvg = renderNode(deck, activeMask);
      out.push(
        `<defs><mask id="${id}" maskUnits="userSpaceOnUse" x="-100%" y="-100%" width="300%" height="300%" style="mask-type:${maskStyle}">${maskSvg}</mask></defs>`,
        `<g mask="url(#${id})">${body}</g>`
      );
    }
    activeMask = null;
    masked = [];
  };
  for (const child of deck.getChildren(nodeId2(node))) {
    if (child.mask === true) {
      flushMask();
      activeMask = child;
      continue;
    }
    const svg = renderNode(deck, child);
    if (!svg) continue;
    if (activeMask) masked.push(svg);
    else out.push(svg);
  }
  flushMask();
  return out.join("\n");
}
function frameToSvg(fig, node) {
  _svgIdSeq = 0;
  _symbolDepth = 0;
  const fw = Math.round(node.size?.x ?? 100);
  const fh = Math.round(node.size?.y ?? 100);
  const body = childrenSvg(fig, node);
  const { defs: bgDefs, bg: bgSvg } = renderRoundedRectFillStack(fig, getFillPaints(node), fw, fh, 0);
  const bgContent = bgSvg || `<rect x="0" y="0" width="${fw}" height="${fh}" fill="white"/>`;
  const defsBlock = bgDefs ? `${bgDefs}
` : "";
  let vx = 0, vy = 0, w = fw, h = fh;
  if (node.frameMaskDisabled === true) {
    const bounds = _contentBounds(fig, node);
    vx = bounds.minX;
    vy = bounds.minY;
    w = Math.ceil(bounds.maxX - bounds.minX);
    h = Math.ceil(bounds.maxY - bounds.minY);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}" height="${h}" viewBox="${vx} ${vy} ${w} ${h}">
${defsBlock}${bgContent}
${body}
</svg>`;
}
function _contentBounds(deck, node, depth = 2) {
  const fw = node.size?.x ?? 0;
  const fh = node.size?.y ?? 0;
  let minX = 0, minY = 0, maxX = fw, maxY = fh;
  for (const child of deck.getChildren(nodeId2(node))) {
    if (child.phase === "REMOVED" || child.visible === false) continue;
    const cx = child.transform?.m02 ?? 0;
    const cy = child.transform?.m12 ?? 0;
    const cw = child.size?.x ?? 0;
    const ch = child.size?.y ?? 0;
    minX = Math.min(minX, cx);
    minY = Math.min(minY, cy);
    maxX = Math.max(maxX, cx + cw);
    maxY = Math.max(maxY, cy + ch);
    if (depth > 0 && child.type === "INSTANCE" && child.symbolData?.symbolID) {
      const symId = child.symbolData.symbolID;
      const sym = deck.getNode(`${symId.sessionID}:${symId.localID}`);
      if (sym) {
        const sw = sym.size?.x || cw;
        const sh = sym.size?.y || ch;
        const sx = cw / sw;
        const sy = ch / sh;
        const symBounds = _contentBounds(deck, sym, depth - 1);
        minX = Math.min(minX, cx + symBounds.minX * sx);
        minY = Math.min(minY, cy + symBounds.minY * sy);
        maxX = Math.max(maxX, cx + symBounds.maxX * sx);
        maxY = Math.max(maxY, cy + symBounds.maxY * sy);
      }
    }
  }
  return { minX, minY, maxX, maxY };
}


// FigFig High-Precision Vector & Lossless Inspection Engine
// Pure isomorphic ES/Worker code (Zero Node.js runtime dependency; works in Web Worker & Node.js)

const MAX_FILE_BYTES = 256 * 1024 * 1024; // 256 MiB desktop limit
const MAX_NODES = 500000;

const _b64Chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
function uint8ToBase64(bytes) {
  let result = "";
  const len = bytes.length;
  let i = 0;
  for (; i + 2 < len; i += 3) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    result +=
      _b64Chars[(n >> 18) & 63] +
      _b64Chars[(n >> 12) & 63] +
      _b64Chars[(n >> 6) & 63] +
      _b64Chars[n & 63];
  }
  if (len - i === 1) {
    const n = bytes[i] << 16;
    result += _b64Chars[(n >> 18) & 63] + _b64Chars[(n >> 12) & 63] + "==";
  } else if (len - i === 2) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8);
    result +=
      _b64Chars[(n >> 18) & 63] +
      _b64Chars[(n >> 12) & 63] +
      _b64Chars[(n >> 6) & 63] +
      "=";
  }
  return result;
}

function toUint8Array(raw) {
  if (!raw) return null;
  if (raw instanceof Uint8Array) return raw;
  if (raw.bytes instanceof Uint8Array) return raw.bytes;
  if (Array.isArray(raw)) return Uint8Array.from(raw);
  if (Array.isArray(raw.bytes)) return Uint8Array.from(raw.bytes);
  const src = raw.bytes && typeof raw.bytes === "object" ? raw.bytes : raw;
  if (typeof src === "object") {
    const keys = Object.keys(src);
    const out = new Uint8Array(keys.length);
    for (let i = 0; i < keys.length; i++) out[i] = src[i] & 0xff;
    return out;
  }
  return null;
}

function inspectImageHeader(bytes) {
  if (!bytes || bytes.length < 24) {
    return { mime: "application/octet-stream", ext: "bin", width: null, height: null };
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A + IHDR at offset 16..24
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const width = view.getUint32(16, false);
    const height = view.getUint32(20, false);
    return { mime: "image/png", ext: "png", width, height };
  }
  // JPEG: FF D8
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    const len = bytes.length;
    while (offset + 9 < len) {
      if (bytes[offset] !== 0xff) {
        offset++;
        continue;
      }
      const marker = bytes[offset + 1];
      if (marker === 0xff) {
        offset++;
        continue;
      }
      if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) {
        offset += 2;
        continue;
      }
      const segLen = (bytes[offset + 2] << 8) | bytes[offset + 3];
      if (segLen < 2 || offset + 2 + segLen > len) break;
      if (
        (marker >= 0xc0 && marker <= 0xc3) ||
        (marker >= 0xc5 && marker <= 0xc7) ||
        (marker >= 0xc9 && marker <= 0xcb) ||
        (marker >= 0xcd && marker <= 0xcf)
      ) {
        const height = (bytes[offset + 5] << 8) | bytes[offset + 6];
        const width = (bytes[offset + 7] << 8) | bytes[offset + 8];
        return { mime: "image/jpeg", ext: "jpg", width, height };
      }
      offset += 2 + segLen;
    }
    return { mime: "image/jpeg", ext: "jpg", width: null, height: null };
  }
  // WebP: RIFF....WEBP
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return { mime: "image/webp", ext: "webp", width: null, height: null };
  }
  return { mime: "image/png", ext: "png", width: null, height: null };
}

function f4(v) {
  return Number.isFinite(v) ? Math.round(v * 10000) / 10000 : 0;
}

function f2(v) {
  return Number.isFinite(v) ? Math.round(v * 100) / 100 : 0;
}

function multiplyAffine(a, b) {
  // [ a.m00 a.m01 a.m02 ]   [ b.m00 b.m01 b.m02 ]
  // [ a.m10 a.m11 a.m12 ] * [ b.m10 b.m11 b.m12 ]
  // [   0     0     1   ]   [   0     0     1   ]
  return {
    m00: a.m00 * b.m00 + a.m01 * b.m10,
    m01: a.m00 * b.m01 + a.m01 * b.m11,
    m02: a.m00 * b.m02 + a.m01 * b.m12 + a.m02,
    m10: a.m10 * b.m00 + a.m11 * b.m10,
    m11: a.m10 * b.m01 + a.m11 * b.m11,
    m12: a.m10 * b.m02 + a.m11 * b.m12 + a.m12
  };
}

function transformBBox(mat, w, h) {
  const pts = [
    { x: 0, y: 0 },
    { x: w, y: 0 },
    { x: w, y: h },
    { x: 0, y: h }
  ];
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const p of pts) {
    const tx = mat.m00 * p.x + mat.m01 * p.y + mat.m02;
    const ty = mat.m10 * p.x + mat.m11 * p.y + mat.m12;
    if (tx < minX) minX = tx;
    if (ty < minY) minY = ty;
    if (tx > maxX) maxX = tx;
    if (ty > maxY) maxY = ty;
  }
  return {
    x: f2(minX),
    y: f2(minY),
    w: f2(Math.max(0, maxX - minX)),
    h: f2(Math.max(0, maxY - minY))
  };
}

function parseDocumentFast(bytes, metaInfo = {}) {
  const t0 = typeof performance !== "undefined" ? performance.now() : Date.now();
  if (!(bytes instanceof Uint8Array) || bytes.length < 16) {
    throw new Error("文件为空或已损坏（少于 16 字节）。");
  }
  if (bytes.length > MAX_FILE_BYTES) {
    throw new Error("文件超过 256 MiB 安全读取上限。");
  }
  const signature = new TextDecoder().decode(bytes.subarray(0, 8));
  let parsed;
  if (bytes[0] === 80 && bytes[1] === 75) {
    let expandedBytes = 0;
    let entries = 0;
    unzipSync(bytes, {
      filter(entry) {
        entries += 1;
        expandedBytes += entry.originalSize;
        if (entries > 50000 || expandedBytes > 1536 * 1024 * 1024) {
          throw new Error("压缩包展开体积超过安全上限。");
        }
        if (entry.name.includes("..") || entry.name.startsWith("/") || entry.name.includes("\\")) {
          throw new Error("检测到不安全的归档路径条目。");
        }
        return false;
      }
    });
    parsed = parseFig(bytes);
  } else if (signature.startsWith("fig-")) {
    parsed = parseFigBinary(bytes);
  } else {
    throw new Error("不是受支持的 Figma (.fig / .deck / fig-kiwi) 文件。");
  }
  if (!Array.isArray(parsed.nodes) || parsed.nodes.length > MAX_NODES) {
    throw new Error("文件节点数异常或超过 500,000 上限。");
  }

  const nodes = new Map();
  for (const node of parsed.nodes) {
    const id = nodeId(node);
    if (id && node.phase !== "REMOVED") {
      nodes.set(id, node);
    }
  }

  const children = new Map();
  const parentMap = new Map();
  for (const [id, node] of nodes.entries()) {
    const parent = node.parentIndex?.guid;
    if (!parent) continue;
    const pid = `${parent.sessionID}:${parent.localID}`;
    parentMap.set(id, pid);
    if (!children.has(pid)) children.set(pid, []);
    children.get(pid).push(node);
  }

  for (const siblings of children.values()) {
    siblings.sort((left, right) => {
      const first = left.parentIndex?.position ?? "";
      const second = right.parentIndex?.position ?? "";
      return first < second ? -1 : first > second ? 1 : 0;
    });
  }

  const pages = [...nodes.values()].filter((node) => node.type === "CANVAS");
  const componentDefinitions = new Map();
  const slotOwnerMap = new Map();
  for (const [id, node] of nodes.entries()) {
    for (const definition of node.componentPropDefs || []) {
      const key = `${definition.id.sessionID}:${definition.id.localID}`;
      if (!componentDefinitions.has(key) || definition.varValue) componentDefinitions.set(key, definition);
    }
    for (const owner of [node, ...(node.symbolData?.symbolOverrides || [])]) {
      for (const assignment of owner.componentPropAssignments || []) {
        const slotGuid = assignment.varValue?.value?.slotContentIdValue?.guid || assignment.value?.slotContentIdValue?.guid;
        if (slotGuid) {
          const slotId = `${slotGuid.sessionID}:${slotGuid.localID}`;
          if (!slotOwnerMap.has(slotId)) slotOwnerMap.set(slotId, id);
        }
      }
    }
  }
  const imageAssets = [];
  for (const [hash, imgBytes] of parsed.images.entries()) {
    const info = inspectImageHeader(imgBytes);
    imageAssets.push({
      hash,
      byteLength: imgBytes.byteLength,
      mime: info.mime,
      ext: info.ext,
      width: info.width,
      height: info.height
    });
  }

  const t1 = typeof performance !== "undefined" ? performance.now() : Date.now();
  const parseMs = Math.max(1, Math.round(t1 - t0));

  return {
    parsed,
    nodes,
    children,
    parentMap,
    slotOwnerMap,
    componentDefinitions,
    pages,
    imageAssets,
    byteLength: bytes.byteLength,
    sha256: metaInfo.sha256 || "",
    fileName: metaInfo.fileName || parsed.meta?.file_name || "Untitled.fig",
    parseMs
  };
}

function summarizeNodeFast(doc, node) {
  const id = nodeId(node);
  return {
    id,
    name: node.name ?? "",
    type: node.type,
    visible: node.visible !== false,
    size: node.size ? { x: f2(node.size.x), y: f2(node.size.y) } : null,
    text: node.textData?.characters ?? null,
    childCount: doc.children.get(id)?.length ?? 0
  };
}

function logicalParentId(doc, curId) {
  if (doc.slotOwnerMap?.has(curId)) return doc.slotOwnerMap.get(curId);
  return doc.parentMap.get(curId);
}

function pageOfNode(doc, idOrNode) {
  let curId = typeof idOrNode === "string" ? idOrNode : nodeId(idOrNode);
  const seen = new Set();
  while (curId && !seen.has(curId)) {
    seen.add(curId);
    const n = doc.nodes.get(curId);
    if (!n) return null;
    if (n.type === "CANVAS") return n;
    curId = logicalParentId(doc, curId);
  }
  return null;
}

function isPreviewableBoardNode(node) {
  if (!node || node.visible === false || node.isSlotContent === true) return false;
  const w = node.size?.x ?? 0;
  const h = node.size?.y ?? 0;
  return (
    ["FRAME", "INSTANCE", "SYMBOL", "SECTION", "COMPONENT"].includes(node.type) &&
    w >= 120 &&
    w <= 20000 &&
    h >= 80 &&
    h <= 30000
  );
}

function findEnclosingBoardId(doc, targetId) {
  let curId = targetId;
  let lastValidBoard = null;
  const seen = new Set();
  while (curId && !seen.has(curId)) {
    seen.add(curId);
    const node = doc.nodes.get(curId);
    if (!node) break;
    if (node.type === "CANVAS") break;
    const pid = logicalParentId(doc, curId);
    const parentNode = pid ? doc.nodes.get(pid) : null;
    if (isPreviewableBoardNode(node)) {
      lastValidBoard = curId;
      if (parentNode && (parentNode.type === "CANVAS" || parentNode.type === "SECTION")) {
        return curId;
      }
    }
    curId = pid;
  }
  return lastValidBoard || targetId;
}

function getBreadcrumbsForNode(doc, targetId) {
  const trail = [];
  let curId = targetId;
  const seen = new Set();
  while (curId && !seen.has(curId)) {
    seen.add(curId);
    const node = doc.nodes.get(curId);
    if (!node) break;
    if (node.type === "DOCUMENT") break;
    trail.push({
      id: curId,
      name: node.name || node.type,
      type: node.type
    });
    curId = logicalParentId(doc, curId);
  }
  return trail.reverse();
}

function getDocumentSummary(doc) {
  return {
    fileName: doc.fileName,
    sha256: doc.sha256,
    byteLength: doc.byteLength,
    formatVersion: doc.parsed.header.version,
    prelude: doc.parsed.header.prelude,
    nodeCount: doc.nodes.size,
    imageCount: doc.parsed.images.size,
    pageCount: doc.pages.length,
    parseMs: doc.parseMs,
    readOnly: true,
    hasThumbnail: Boolean(doc.parsed.thumbnail),
    pages: doc.pages.map((p) => ({
      ...summarizeNodeFast(doc, p),
      internalOnly: p.internalOnly === true
    }))
  };
}

function getPagesList(doc, options = {}) {
  return getDocumentSummary(doc).pages.filter(
    (p) => options.includeInternal || !p.internalOnly
  );
}

function paginateItems(items, options = {}) {
  const offset = Number.isInteger(options.offset) ? Math.max(0, options.offset) : 0;
  const limit = Number.isInteger(options.limit) ? Math.min(500, Math.max(1, options.limit)) : 120;
  return {
    items: items.slice(offset, offset + limit),
    total: items.length,
    offset,
    nextOffset: offset + limit < items.length ? offset + limit : null
  };
}

function getFramesOnPage(doc, pageId, options = {}) {
  const page = doc.nodes.get(pageId);
  if (!page || page.type !== "CANVAS") throw new Error("需要有效的页面 ID。");
  const result = [];
  const topChildren = doc.children.get(pageId) ?? [];
  const pending = [...topChildren].reverse();
  const seen = new Set();
  while (pending.length) {
    const node = pending.pop();
    const id = nodeId(node);
    if (!id || seen.has(id) || node.visible === false) continue;
    seen.add(id);
    const width = node.size?.x ?? 0;
    const height = node.size?.y ?? 0;
    const isBoard =
      ["FRAME", "INSTANCE", "SYMBOL", "COMPONENT"].includes(node.type) &&
      width >= 200 &&
      width <= 12000 &&
      height >= 100 &&
      height <= 30000;
    if (isBoard) {
      result.push(summarizeNodeFast(doc, node));
    } else {
      const sub = doc.children.get(id) ?? [];
      for (let i = sub.length - 1; i >= 0; i--) pending.push(sub[i]);
    }
  }
  // Fallback: if a page only has smaller components/icons/groups, list direct drawable children
  if (!result.length) {
    for (const child of topChildren) {
      if (child.visible === false) continue;
      if ((child.size?.x ?? 0) > 0 && (child.size?.y ?? 0) > 0) {
        result.push(summarizeNodeFast(doc, child));
      }
    }
  }
  return paginateItems(result, options);
}

function getChildrenOfNode(doc, id, options = {}) {
  const scene = doc.renderScene?.nodes.has(id) ? doc.renderScene : doc;
  if (!scene.nodes.has(id)) throw new Error("未找到指定节点。");
  const list = (scene.children.get(id) ?? []).map((n) => summarizeNodeFast(scene, n));
  return paginateItems(list, options);
}

function colorToHexAndRgba(colorObj, opacity = 1) {
  if (!colorObj) return { hex: "#000000", rgba: "rgba(0, 0, 0, 1)", alpha: 100 };
  const r = Math.max(0, Math.min(255, Math.round((colorObj.r ?? 0) * 255)));
  const g = Math.max(0, Math.min(255, Math.round((colorObj.g ?? 0) * 255)));
  const b = Math.max(0, Math.min(255, Math.round((colorObj.b ?? 0) * 255)));
  const a = Math.max(0, Math.min(1, (colorObj.a ?? 1) * (opacity ?? 1)));
  const hex =
    "#" +
    [r, g, b]
      .map((v) => v.toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase();
  return {
    hex,
    rgba: `rgba(${r}, ${g}, ${b}, ${f2(a)})`,
    alpha: Math.round(a * 100)
  };
}

function generateCssForNode(node) {
  const lines = [];
  const nameComment = (node.name || node.type || "layer").replace(/\*\//g, "");
  lines.push(`/* ${nameComment} (${node.type}) */`);
  if (node.size?.x !== undefined && node.size?.y !== undefined) {
    lines.push(`width: ${f2(node.size.x)}px;`);
    lines.push(`height: ${f2(node.size.y)}px;`);
  }
  if (node.opacity !== undefined && node.opacity < 1) {
    lines.push(`opacity: ${f2(node.opacity)};`);
  }
  // Auto-layout
  if (node.stackMode === "HORIZONTAL" || node.stackMode === "VERTICAL") {
    lines.push(`display: flex;`);
    lines.push(`flex-direction: ${node.stackMode === "HORIZONTAL" ? "row" : "column"};`);
    if (node.stackSpacing) lines.push(`gap: ${f2(node.stackSpacing)}px;`);
    const pt = f2(node.stackVerticalPadding ?? 0);
    const pr = f2(node.stackPaddingRight ?? node.stackHorizontalPadding ?? 0);
    const pb = f2(node.stackPaddingBottom ?? node.stackVerticalPadding ?? 0);
    const pl = f2(node.stackHorizontalPadding ?? 0);
    if (pt || pr || pb || pl) {
      lines.push(`padding: ${pt}px ${pr}px ${pb}px ${pl}px;`);
    }
  }
  // Border radius
  if (node.rectangleCornerRadiiIndependent) {
    const tl = f2(node.rectangleTopLeftCornerRadius ?? 0);
    const tr = f2(node.rectangleTopRightCornerRadius ?? 0);
    const br = f2(node.rectangleBottomRightCornerRadius ?? 0);
    const bl = f2(node.rectangleBottomLeftCornerRadius ?? 0);
    lines.push(`border-radius: ${tl}px ${tr}px ${br}px ${bl}px;`);
  } else if (node.cornerRadius) {
    lines.push(`border-radius: ${f2(node.cornerRadius)}px;`);
  }
  // Fills
  const fills = (node.fillPaints ?? []).filter((p) => p.visible !== false);
  for (const paint of fills) {
    if (paint.type === "SOLID" && paint.color) {
      const c = colorToHexAndRgba(paint.color, paint.opacity ?? 1);
      if (node.type === "TEXT") {
        lines.push(`color: ${c.alpha === 100 ? c.hex : c.rgba};`);
      } else {
        lines.push(`background: ${c.alpha === 100 ? c.hex : c.rgba};`);
      }
    } else if (paint.type === "GRADIENT_LINEAR" && Array.isArray(paint.stops)) {
      const stops = paint.stops
        .map((s) => {
          const c = colorToHexAndRgba(s.color, paint.opacity ?? 1);
          return `${c.alpha === 100 ? c.hex : c.rgba} ${Math.round((s.position ?? 0) * 100)}%`;
        })
        .join(", ");
      lines.push(`background: linear-gradient(135deg, ${stops});`);
    }
  }
  // Strokes
  const strokes = (node.strokePaints ?? []).filter((p) => p.visible !== false && p.type === "SOLID");
  if (strokes.length && (node.strokeWeight ?? 0) > 0) {
    const sc = colorToHexAndRgba(strokes[0].color, strokes[0].opacity ?? 1);
    lines.push(`border: ${f2(node.strokeWeight)}px solid ${sc.alpha === 100 ? sc.hex : sc.rgba};`);
  }
  // Drop shadows
  const shadows = (node.effects ?? []).filter(
    (e) => e.visible !== false && (e.type === "DROP_SHADOW" || e.type === "INNER_SHADOW")
  );
  if (shadows.length) {
    const shList = shadows.map((s) => {
      const sc = colorToHexAndRgba(s.color, 1);
      const inset = s.type === "INNER_SHADOW" ? "inset " : "";
      return `${inset}${f2(s.offset?.x ?? 0)}px ${f2(s.offset?.y ?? 0)}px ${f2(s.radius ?? 0)}px ${sc.rgba}`;
    });
    lines.push(`box-shadow: ${shList.join(", ")};`);
  }
  // Typography
  if (node.type === "TEXT" || node.fontName || node.fontSize) {
    if (node.fontName?.family) {
      lines.push(`font-family: "${node.fontName.family}", sans-serif;`);
    }
    if (node.fontSize) {
      lines.push(`font-size: ${f2(node.fontSize)}px;`);
    }
    if (node.fontName?.style) {
      const st = node.fontName.style;
      const weight = /black/i.test(st)
        ? 900
        : /extrabold|heavy/i.test(st)
        ? 800
        : /bold/i.test(st) && !/semi/i.test(st)
        ? 700
        : /semibold|demibold/i.test(st)
        ? 600
        : /medium/i.test(st)
        ? 500
        : /light/i.test(st)
        ? 300
        : 400;
      lines.push(`font-weight: ${weight};`);
      if (/italic/i.test(st)) lines.push(`font-style: italic;`);
    }
    if (node.lineHeight?.value) {
      if (node.lineHeight.units === "PIXELS") {
        lines.push(`line-height: ${f2(node.lineHeight.value)}px;`);
      } else if (node.lineHeight.units === "PERCENT") {
        lines.push(`line-height: ${f2(node.lineHeight.value)}%;`);
      }
    }
    if (node.textAlignHorizontal) {
      lines.push(`text-align: ${node.textAlignHorizontal.toLowerCase()};`);
    }
  }
  return lines.join("\n");
}

function sanitizeForJson(value) {
  if (typeof value === "bigint") return Number(value);
  if (value instanceof Uint8Array) return Array.from(value);
  if (Array.isArray(value)) return value.map(sanitizeForJson);
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = sanitizeForJson(v);
    return out;
  }
  return value;
}

function getNodeDetail(doc, id, options = {}) {
  let resolvedId = id;
  let scene = doc.renderScene?.nodes.has(id) ? doc.renderScene : null;
  if (!scene && doc.renderScene) {
    for (const [sId, sNode] of doc.renderScene.nodes.entries()) {
      if (sNode.originalNodeId === id) {
        scene = doc.renderScene;
        resolvedId = sId;
        break;
      }
    }
  }
  const source = scene || doc;
  const node = source.nodes.get(resolvedId);
  if (!node) throw new Error("未找到节点：" + id);
  const parentId = source.parentMap.get(resolvedId) ?? null;
  const pageNode = pageOfNode(doc, scene ? scene.frameId : node);
  const enclosingFrameId = scene ? scene.frameId : findEnclosingBoardId(doc, id);
  const symbol = node.symbolData?.symbolID;
  const properties = {};
  for (const key of [
    "transform",
    "opacity",
    "fillPaints",
    "strokePaints",
    "strokeWeight",
    "strokeAlign",
    "cornerRadius",
    "rectangleCornerRadiiIndependent",
    "rectangleTopLeftCornerRadius",
    "rectangleTopRightCornerRadius",
    "rectangleBottomLeftCornerRadius",
    "rectangleBottomRightCornerRadius",
    "fontName",
    "fontSize",
    "lineHeight",
    "letterSpacing",
    "textAlignHorizontal",
    "textAlignVertical",
    "stackMode",
    "stackSpacing",
    "stackHorizontalPadding",
    "stackVerticalPadding",
    "stackPaddingRight",
    "stackPaddingBottom",
    "stackPrimaryAlignItems",
    "stackCounterAlignItems",
    "stackPrimarySizing",
    "stackCounterSizing",
    "frameMaskDisabled",
    "effects",
    "blendMode"
  ]) {
    if (node[key] !== undefined) properties[key] = node[key];
  }

  const overrides = (node.symbolData?.symbolOverrides ?? []).map((ov) => ({
    path: ov.guidPath?.guids?.map((g) => `${g.sessionID}:${g.localID}`) ?? [],
    text: ov.textData?.characters ?? null,
    visible: ov.visible,
    fills: ov.fillPaints,
    symbolId: ov.overriddenSymbolID
      ? `${ov.overriddenSymbolID.sessionID}:${ov.overriddenSymbolID.localID}`
      : null
  }));

  const parsedFills = (node.fillPaints ?? [])
    .filter((p) => p.visible !== false)
    .map((p) => {
      if (p.type === "SOLID" && p.color) {
        return {
          type: "SOLID",
          ...colorToHexAndRgba(p.color, p.opacity ?? 1)
        };
      }
      if (p.type === "IMAGE") {
        const hashBytes = p.image?.hash;
        const hash = hashBytes?.length ? hashToHex(hashBytes) : p.image?.name;
        return {
          type: "IMAGE",
          imageHash: hash || null,
          scaleMode: p.imageScaleMode ?? "FILL",
          opacity: Math.round((p.opacity ?? 1) * 100)
        };
      }
      if (p.type === "GRADIENT_LINEAR" || p.type === "GRADIENT_RADIAL") {
        return {
          type: p.type,
          stops: (p.stops ?? []).map((s) => ({
            position: Math.round((s.position ?? 0) * 100),
            ...colorToHexAndRgba(s.color, p.opacity ?? 1)
          }))
        };
      }
      return { type: p.type };
    });

  const parsedStrokes = (node.strokePaints ?? [])
    .filter((p) => p.visible !== false && p.type === "SOLID" && p.color)
    .map((p) => ({
      weight: f2(node.strokeWeight ?? 1),
      align: node.strokeAlign ?? "CENTER",
      ...colorToHexAndRgba(p.color, p.opacity ?? 1)
    }));

  return {
    ...summarizeNodeFast(source, node),
    id,
    parentId,
    pageId: pageNode ? nodeId(pageNode) : null,
    pageName: pageNode?.name ?? "",
    enclosingFrameId,
    sourceNodeId: node.originalNodeId || id,
    instancePath: node.instancePath || [],
    breadcrumbs: getBreadcrumbsForNode(source, resolvedId),
    componentId: symbol ? `${symbol.sessionID}:${symbol.localID}` : null,
    properties: sanitizeForJson(properties),
    parsedFills,
    parsedStrokes,
    cssCode: generateCssForNode(node),
    overrides: paginateItems(sanitizeForJson(overrides), options),
    cachedGlyphs: node.derivedTextData?.glyphs?.length ?? 0,
    cachedInstanceLayoutEntries: node.derivedSymbolData?.length ?? 0,
    interactions: (node.prototypeInteractions ?? []).length,
    children: getChildrenOfNode(doc, resolvedId, options)
  };
}

function extractNodeAssignedTexts(node) {
  const parts = [];
  const collectAssignments = (assignments) => {
    for (const a of assignments || []) {
      const t =
        a.varValue?.value?.textDataValue?.characters ??
        a.varValue?.value?.textValue ??
        a.value?.textDataValue?.characters ??
        a.value?.textValue;
      if (typeof t === "string" && t) parts.push(t);
    }
  };
  collectAssignments(node.componentPropAssignments);
  for (const ov of node.symbolData?.symbolOverrides ?? []) {
    if (ov.textData?.characters) parts.push(ov.textData.characters);
    collectAssignments(ov.componentPropAssignments);
  }
  return parts.join("\n");
}

function searchNodesFast(doc, query, options = {}) {
  if (typeof query !== "string" || !query.trim() || query.length > 200) {
    throw new Error("搜索词长度需在 1~200 个字符之间。");
  }
  const needle = query.trim().toLocaleLowerCase();
  const scopeAllPages = options.allPages === true;
  const matches = [];
  for (const [id, node] of doc.nodes.entries()) {
    if (node.type === "DOCUMENT" || node.type === "CANVAS") continue;
    const text = node.textData?.characters ?? "";
    const overrideText = extractNodeAssignedTexts(node);
    const nameStr = node.name ?? "";
    if (
      !nameStr.toLocaleLowerCase().includes(needle) &&
      !text.toLocaleLowerCase().includes(needle) &&
      !overrideText.toLocaleLowerCase().includes(needle)
    ) {
      continue;
    }
    const page = pageOfNode(doc, node);
    const pId = page ? nodeId(page) : null;
    if (!scopeAllPages && options.pageId && pId !== options.pageId) continue;
    if (!options.includeInternal && page?.internalOnly) continue;
    const frameId = findEnclosingBoardId(doc, id);
    const frameNode = frameId ? doc.nodes.get(frameId) : null;
    matches.push({
      ...summarizeNodeFast(doc, node),
      pageId: pId,
      pageName: page?.name ?? "",
      frameId,
      frameName: frameNode?.name ?? "",
      text: (text || overrideText).slice(0, 400),
      overrideText: overrideText.slice(0, 400)
    });
  }
  return paginateItems(matches, options);
}

function getCompatibilityReport(doc) {
  const types = {};
  const fonts = new Set();
  const risks = new Map();
  let totalGlyphOutlines = 0;
  let totalTextNodes = 0;
  const add = (code, id) => {
    const entry = risks.get(code) ?? { code, count: 0, examples: [] };
    entry.count += 1;
    if (entry.examples.length < 5) entry.examples.push(id);
    risks.set(code, entry);
  };
  for (const [id, node] of doc.nodes.entries()) {
    types[node.type] = (types[node.type] ?? 0) + 1;
    if (node.fontName?.family) fonts.add(node.fontName.family);
    if (node.type === "TEXT") {
      totalTextNodes += 1;
      if (node.derivedTextData?.glyphs?.length) {
        totalGlyphOutlines += 1;
      } else {
        add("FONT_FALLBACK", id);
      }
    }
    if (["BRUSH", "WIDGET", "VIDEO", "EMBED"].includes(node.type)) add("UNSUPPORTED_NODE", id);
    if (node.mask && node.maskType && !["ALPHA", "VECTOR", "OUTLINE", "LUMINANCE"].includes(node.maskType)) add("MASK_SEMANTICS", id);
    if (
      node.effects?.some(
        (effect) =>
          effect.visible !== false &&
          effect.type !== "DROP_SHADOW"
      )
    ) {
      add("EFFECT_APPROXIMATION", id);
    }
    if (node.blendMode && !["NORMAL", "PASS_THROUGH"].includes(node.blendMode)) {
      add("BLEND_MODE", id);
    }
    if (
      node.fillPaints?.some(
        (paint) => paint.visible !== false && ["VIDEO", "GRADIENT_ANGULAR", "GRADIENT_DIAMOND"].includes(paint.type)
      )
    ) {
      add("UNSUPPORTED_FILL", id);
    }
    if (node.prototypeInteractions?.length) add("STATIC_INTERACTIONS", id);
  }
  return {
    renderer: "FigFig instance-scoped compatible renderer",
    readOnly: true,
    visualFidelity: "not-certified-lossless",
    currentFrameResolution: doc.renderScene?.diagnostics || null,
    sha256: doc.sha256,
    byteLength: doc.byteLength,
    parseMs: doc.parseMs,
    totalTextNodes,
    totalGlyphOutlines,
    fonts: [...fonts].sort(),
    types,
    warnings: [...risks.values()]
  };
}

// ============================================================================
// High-Precision Vector SVG & Interactive Hit-Map Renderer
// ============================================================================

function independentRoundedRectPath(x, y, w, h, radii) {
  let [tl, tr, br, bl] = radii.map((r) => Math.max(0, r || 0));
  const maxR = Math.min(w, h) / 2;
  tl = Math.min(tl, maxR);
  tr = Math.min(tr, maxR);
  br = Math.min(br, maxR);
  bl = Math.min(bl, maxR);
  return [
    `M${f4(x + tl)} ${f4(y)}`,
    `H${f4(x + w - tr)}`,
    tr > 0 ? `A${f4(tr)} ${f4(tr)} 0 0 1 ${f4(x + w)} ${f4(y + tr)}` : "",
    `V${f4(y + h - br)}`,
    br > 0 ? `A${f4(br)} ${f4(br)} 0 0 1 ${f4(x + w - br)} ${f4(y + h)}` : "",
    `H${f4(x + bl)}`,
    bl > 0 ? `A${f4(bl)} ${f4(bl)} 0 0 1 ${f4(x)} ${f4(y + h - bl)}` : "",
    `V${f4(y + tl)}`,
    tl > 0 ? `A${f4(tl)} ${f4(tl)} 0 0 1 ${f4(x + tl)} ${f4(y)}` : "",
    "Z"
  ]
    .filter(Boolean)
    .join(" ");
}

function getNodeRadii(node) {
  if (
    node.rectangleCornerRadiiIndependent ||
    node.rectangleTopLeftCornerRadius !== undefined ||
    node.rectangleTopRightCornerRadius !== undefined ||
    node.rectangleBottomRightCornerRadius !== undefined ||
    node.rectangleBottomLeftCornerRadius !== undefined
  ) {
    const fallback = node.cornerRadius ?? 0;
    const tl = node.rectangleTopLeftCornerRadius ?? fallback;
    const tr = node.rectangleTopRightCornerRadius ?? fallback;
    const br = node.rectangleBottomRightCornerRadius ?? fallback;
    const bl = node.rectangleBottomLeftCornerRadius ?? fallback;
    if (tl !== tr || tl !== br || tl !== bl) {
      return { independent: true, radii: [tl, tr, br, bl], uniform: tl };
    }
    return { independent: false, radii: [tl, tr, br, bl], uniform: tl };
  }
  const r = node.cornerRadius ?? 0;
  return { independent: false, radii: [r, r, r, r], uniform: r };
}

function decodeCmdBlobFast(blobs, blobIdx) {
  if (blobIdx == null || !blobs?.[blobIdx]) return null;
  const bytes = toUint8Array(blobs[blobIdx]);
  if (!bytes || !bytes.length) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const commands = [];
  const verbs = ["Z", "M", "L", "Q", "C"];
  const coordinateCounts = [0, 2, 2, 4, 6];
  let offset = 0;
  while (offset < bytes.length) {
    const opcode = bytes[offset++];
    const count = coordinateCounts[opcode];
    if (count === undefined) throw new Error(`Unsupported path opcode ${opcode} in blob ${blobIdx}.`);
    if (offset + count * 4 > bytes.length) throw new Error(`Truncated path in blob ${blobIdx}.`);
    const coordinates = [];
    for (let coordinate = 0; coordinate < count; coordinate += 1) {
      const value = view.getFloat32(offset, true);
      if (!Number.isFinite(value)) throw new Error(`Invalid path coordinate in blob ${blobIdx}.`);
      coordinates.push(String(value));
      offset += 4;
    }
    commands.push(verbs[opcode] + coordinates.join(" "));
  }
  return commands.length ? commands.join("") : null;
}

function renderGlyphOutlinesFast(doc, node, counts) {
  const chars = node.textData?.characters ?? "";
  const baselines = node.derivedTextData?.baselines;
  const glyphs = node.derivedTextData?.glyphs;
  if (!glyphs?.length || isStaleLayout(chars, baselines, glyphs)) {
    counts.fallbackText += 1;
    return null;
  }
  const spans = [];
  for (const glyph of glyphs) {
    const blob = getBlobBytes(doc.parsed, glyph.commandsBlob);
    if (!blob) {
      counts.fallbackText += 1;
      return null;
    }
    let path;
    try {
      path = decodeCmdBlobFast(doc.parsed.message.blobs, glyph.commandsBlob)?.replace(/^Z+/, "");
    } catch {
      counts.fallbackText += 1;
      return null;
    }
    if (!path) {
      counts.emptyGlyphs += 1;
      continue;
    }
    const styleId = node.textData?.characterStyleIDs?.[glyph.firstCharacter];
    const style = node.textData?.styleOverrideTable?.find((entry) => entry.styleID === styleId);
    const size2 = glyph.fontSize ?? node.fontSize ?? 14;
    const position = glyph.position ?? { x: 0, y: 0 };
    const fillPaint = (style?.fillPaints ?? node.fillPaints)?.find(
      (entry) => entry.visible !== false && entry.type === "SOLID"
    );
    const fillColor = fillPaint ? cssColor(fillPaint.color ?? {}, fillPaint.opacity ?? 1) : "#202326";
    spans.push(
      `<g transform="translate(${f4(position.x)},${f4(position.y)}) rotate(${f4(
        ((glyph.rotation ?? 0) * 180) / Math.PI
      )}) scale(${f4(size2)},${f4(-size2)})"><path d="${path}" fill="${fillColor}"/></g>`
    );
  }
  const baseFillPaint = node.fillPaints?.find(
    (entry) => entry.visible !== false && entry.type === "SOLID"
  );
  const baseColor = baseFillPaint
    ? cssColor(baseFillPaint.color ?? {}, baseFillPaint.opacity ?? 1)
    : "#202326";
  for (const decoration of node.derivedTextData?.decorations ?? []) {
    for (const rect of decoration.rects ?? []) {
      spans.push(
        `<rect x="${f4(rect.x)}" y="${f4(rect.y)}" width="${f4(rect.w)}" height="${f4(
          rect.h
        )}" fill="${baseColor}"/>`
      );
    }
  }
  counts.outlinedText += 1;
  const transform = node.transform ?? {};
  return `<g transform="matrix(${f4(transform.m00 ?? 1)},${f4(transform.m10 ?? 0)},${f4(
    transform.m01 ?? 0
  )},${f4(transform.m11 ?? 1)},${f4(transform.m02 ?? 0)},${f4(transform.m12 ?? 0)})">${spans.join(
    ""
  )}</g>`;
}

function frameStrokeSvgFast(node, width, height, radius, stroke) {
  const radiiInfo = getNodeRadii(node);
  if (!node.borderStrokeWeightsIndependent) {
    if (radiiInfo.independent && stroke) {
      const pathD = independentRoundedRectPath(0, 0, width, height, radiiInfo.radii);
      return `<path d="${pathD}" fill="none" stroke="${stroke.color}" stroke-width="${stroke.width}"/>`;
    }
    return rectStrokeSvg(0, 0, width, height, radius, stroke);
  }
  const color = resolveFill(node.strokePaints);
  if (!color) return "";
  const weights = [node.borderTopWeight, node.borderRightWeight, node.borderBottomWeight, node.borderLeftWeight].map((value) => Math.max(0, value ?? 0));
  const align = node.strokeAlign ?? "CENTER";
  if (weights.every((value) => value === weights[0])) return weights[0] ? rectStrokeSvg(0, 0, width, height, radius, { color, width: weights[0], align }) : "";
  return weights.map((weight, index) => {
    if (!weight) return "";
    const inset = align === "INSIDE" ? weight / 2 : align === "OUTSIDE" ? -weight / 2 : 0;
    if (!radius && !radiiInfo.independent) {
      const paths = [`M0 ${inset}H${width}`, `M${width - inset} 0V${height}`, `M0 ${height - inset}H${width}`, `M${inset} 0V${height}`];
      return `<path d="${paths[index]}" fill="none" stroke="${color}" stroke-width="${weight}"/>`;
    }
    const outside = align === "INSIDE" ? 0 : Math.max(...weights);
    const corners = [[-outside, -outside], [width + outside, -outside], [width + outside, height + outside], [-outside, height + outside]];
    const polygon = [corners[index], corners[(index + 1) % 4], [width / 2, height / 2]].map((point) => point.join(",")).join(" ");
    const clipId = `border-side-${++_svgIdSeq}`;
    const baseStroke = radiiInfo.independent
      ? `<path d="${independentRoundedRectPath(0, 0, width, height, radiiInfo.radii)}" fill="none" stroke="${color}" stroke-width="${weight}"/>`
      : rectStrokeSvg(0, 0, width, height, radius, { color, width: weight, align });
    return `<defs><clipPath id="${clipId}"><polygon points="${polygon}"/></clipPath></defs><g clip-path="url(#${clipId})">${baseStroke}</g>`;
  }).join("");
}

function resolvePaintColorOrGradientFast(paints, w, h) {
  if (!paints?.length) return null;
  const visible = paints.filter((p) => p.visible !== false);
  for (const p of visible) {
    if (p.type === "SOLID" && p.color) {
      return { paint: cssColor(p.color, p.opacity ?? 1), defs: "", opacityAttr: "" };
    }
    if (p.type === "GRADIENT_LINEAR" || p.type === "GRADIENT_RADIAL") {
      const grad = resolveGradientSvg(p, Math.max(1, w || 1), Math.max(1, h || 1));
      if (grad) return { paint: grad.fill, defs: grad.defs, opacityAttr: grad.opacityAttr || "" };
      if (p.stops?.[0]?.color) {
        return { paint: cssColor(p.stops[0].color, p.opacity ?? 1), defs: "", opacityAttr: "" };
      }
    }
    if ((p.type === "GRADIENT_ANGULAR" || p.type === "GRADIENT_DIAMOND") && p.stops?.[0]?.color) {
      return { paint: cssColor(p.stops[0].color, p.opacity ?? 1), defs: "", opacityAttr: "" };
    }
  }
  return null;
}

function renderVectorFast(deck, node) {
  const t = node.transform ?? {};
  const m00 = t.m00 ?? 1, m01 = t.m01 ?? 0, m02 = t.m02 ?? 0;
  const m10 = t.m10 ?? 0, m11 = t.m11 ?? 1, m12 = t.m12 ?? 0;
  const { w, h } = size(node);
  const blobs = deck.message?.blobs;
  const parts = [];
  let defs = "";
  const baseFill = resolvePaintColorOrGradientFast(getFillPaints(node), w, h);
  if (baseFill?.defs) defs = appendDefs(defs, baseFill.defs);
  const fillColor = baseFill?.paint ?? null;
  const fillOpacityAttr = baseFill?.opacityAttr ?? "";
  const fillEntries = [];
  if (node.fillGeometry?.length && blobs) {
    const styleMap = new Map();
    if (node.vectorData?.styleOverrideTable?.length) {
      for (const s of node.vectorData.styleOverrideTable) {
        if (s.styleID != null && s.fillPaints) {
          const resolved = resolvePaintColorOrGradientFast(s.fillPaints, w, h);
          if (resolved?.defs) defs = appendDefs(defs, resolved.defs);
          styleMap.set(s.styleID, resolved);
        }
      }
    }
    for (const geo of node.fillGeometry) {
      const stylePaint = geo.styleID && styleMap.has(geo.styleID) ? styleMap.get(geo.styleID) : null;
      const color2 = stylePaint ? stylePaint.paint : fillColor;
      const opAttr = stylePaint ? (stylePaint.opacityAttr || "") : fillOpacityAttr;
      if (!color2) continue;
      const d = decodeCmdBlob(blobs, geo.commandsBlob);
      if (!d) continue;
      const rule = (geo.windingRule === "ODD" || geo.windingRule === "EVENODD") ? ' fill-rule="evenodd"' : "";
      fillEntries.push({ d, color: color2, opAttr, rule });
    }
  }
  const strokeResolved = resolvePaintColorOrGradientFast(node.strokePaints, w, h);
  if (strokeResolved?.defs) defs = appendDefs(defs, strokeResolved.defs);
  const strokeColor = strokeResolved?.paint ?? null;
  const sw = node.strokeWeight ?? 0;
  const strokeAlign = node.strokeAlign ?? "CENTER";
  const dashAttr = Array.isArray(node.dashPattern) && node.dashPattern.length ? ` stroke-dasharray="${node.dashPattern.join(" ")}"` : "";
  const lineCap = node.strokeCap === "ROUND" ? "round" : node.strokeCap === "SQUARE" ? "square" : "butt";
  const lineJoin = node.strokeJoin === "ROUND" ? "round" : node.strokeJoin === "BEVEL" ? "bevel" : "miter";
  if (strokeAlign === "OUTSIDE" && strokeColor && sw > 0 && fillEntries.length) {
    for (const { d, rule } of fillEntries) {
      parts.push(
        `<path d="${d}" fill="none" stroke="${strokeColor}" stroke-width="${sw * 2}" stroke-linecap="${lineCap}" stroke-linejoin="${lineJoin}"${dashAttr}${rule}/>`
      );
    }
    for (const { d, color: color2, opAttr, rule } of fillEntries) {
      parts.push(`<path d="${d}" fill="${color2}"${opAttr}${rule}/>`);
    }
  } else {
    for (const { d, color: color2, opAttr, rule } of fillEntries) {
      parts.push(`<path d="${d}" fill="${color2}"${opAttr}${rule}/>`);
    }
    if (strokeColor && sw > 0 && node.strokeGeometry?.length && blobs) {
      const segments = [];
      let hasEvenOdd = false;
      for (const geo of node.strokeGeometry) {
        const d = decodeCmdBlob(blobs, geo.commandsBlob);
        if (d) segments.push(d);
        if (geo.windingRule === "ODD" || geo.windingRule === "EVENODD") hasEvenOdd = true;
      }
      if (segments.length) {
        const rule = segments.length > 1 || hasEvenOdd ? ' fill-rule="evenodd"' : "";
        parts.push(`<path d="${segments.join("")}" fill="${strokeColor}"${rule}/>`);
      }
    }
  }
  if (!parts.length && node.vectorData?.vectorNetworkBlob != null && blobs) {
    const vnbD = decodeVnb(blobs, node.vectorData.vectorNetworkBlob, node.vectorData.normalizedSize, node.size);
    if (vnbD) {
      if (!fillColor && strokeColor && sw > 0) {
        parts.push(
          `<path d="${vnbD}" fill="none" stroke="${strokeColor}" stroke-width="${sw}" stroke-linecap="${lineCap}" stroke-linejoin="${lineJoin}"${dashAttr}/>`
        );
      } else {
        const color2 = fillColor ?? strokeColor ?? "#000000";
        parts.push(`<path d="${vnbD}" fill="${color2}"${fillOpacityAttr} fill-rule="evenodd"/>`);
      }
    }
  }
  if (!parts.length) return renderPlaceholder(deck, node);
  return `<g transform="matrix(${m00},${m10},${m01},${m11},${m02},${m12})">
${defs ? `${defs}\n` : ""}${parts.join("\n")}
</g>`;
}

function renderBooleanOpFast(deck, node) {
  const ownSvg = renderVectorFast(deck, node);
  let inner = "";
  if (node.booleanOperation === "UNION") {
    const hasVisibleFill = getFillPaints(node)?.some((p) => p.visible !== false);
    if (hasVisibleFill) {
      const children = deck.getChildren(nodeId2(node));
      const childParts = [];
      for (const child of children) {
        if (child.phase === "REMOVED") continue;
        const origFills = child.fillPaints;
        child.fillPaints = getFillPaints(node);
        childParts.push(renderNode(deck, child));
        child.fillPaints = origFills;
      }
      inner = childParts.filter(Boolean).join("\n");
    }
  }
  if (!ownSvg && !inner) return "";
  if (!inner) return ownSvg;
  if (!ownSvg) {
    const t = node.transform ?? {};
    const m00 = t.m00 ?? 1, m01 = t.m01 ?? 0, m02 = t.m02 ?? 0;
    const m10 = t.m10 ?? 0, m11 = t.m11 ?? 1, m12 = t.m12 ?? 0;
    return `<g transform="matrix(${m00},${m10},${m01},${m11},${m02},${m12})">\n${inner}\n</g>`;
  }
  return `${ownSvg}\n${inner}`;
}

function renderEllipseFast(deck, node) {
  const { w, h } = size(node);
  const cx = w / 2;
  const cy = h / 2;
  const rx = w / 2;
  const ry = h / 2;
  const fills = getFillPaints(node)?.filter((p) => p.visible !== false) ?? [];
  let fillSvg = "";
  if (fills.some((p) => p.type !== "SOLID")) {
    const stack = renderRoundedRectFillStack(deck, fills, w, h, 0);
    if (stack.bg) {
      const clipId = `ellipse-clip-${++_svgIdSeq}`;
      const defs = appendDefs(stack.defs, `<clipPath id="${clipId}"><ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}"/></clipPath>`);
      fillSvg = `${defs}\n<g clip-path="url(#${clipId})">${stack.bg}</g>`;
    }
  } else {
    const fill2 = resolveFill(fills) ?? "none";
    fillSvg = `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill2}"/>`;
  }
  const geoStroke = strokeGeometrySvg(deck, node);
  const strokeSvg = geoStroke || ellipseStrokeSvg(cx, cy, rx, ry, strokeSpec(node));
  const inner = geoStroke ? [strokeSvg, fillSvg].filter(Boolean).join("\n") : [fillSvg, strokeSvg].filter(Boolean).join("\n");
  return `<g transform="${svgTransform(node)}">\n${inner}\n</g>`;
}

function renderRectFast(deck, node) {
  const { w, h } = size(node);
  const radiiInfo = getNodeRadii(node);
  if (radiiInfo.independent) {
    const pathD = independentRoundedRectPath(0, 0, w, h, radiiInfo.radii);
    const fills = getFillPaints(node)?.filter((p) => p.visible !== false) ?? [];
    let fillSvg = "";
    if (fills.some((p) => p.type !== "SOLID")) {
      const stack = renderRoundedRectFillStack(deck, fills, w, h, 0);
      if (stack.bg) {
        const clipId = `rect-clip-${++_svgIdSeq}`;
        const defs = appendDefs(stack.defs, `<clipPath id="${clipId}"><path d="${pathD}"/></clipPath>`);
        fillSvg = `${defs}\n<g clip-path="url(#${clipId})">${stack.bg}</g>`;
      }
    } else {
      const fillColor = resolveFill(fills) ?? "none";
      if (fillColor !== "none") fillSvg = `<path d="${pathD}" fill="${fillColor}"/>`;
    }
    const geoStroke = strokeGeometrySvg(deck, node);
    const stroke = strokeSpec(node);
    const strokeSvg = geoStroke || (stroke ? `<path d="${pathD}" fill="none" stroke="${stroke.color}" stroke-width="${stroke.width}"/>` : "");
    const inner = [fillSvg, strokeSvg].filter(Boolean).join("\n");
    return inner ? `<g transform="${svgTransform(node)}">\n${inner}\n</g>` : "";
  }
  const rx = Math.min(node.cornerRadius ?? 0, w / 2, h / 2);
  const { defs, bg } = renderRoundedRectFillStack(deck, getFillPaints(node), w, h, rx);
  const fillSvg = bg ? `${[defs, bg].filter(Boolean).join("\n")}` : "";
  const geoStroke = strokeGeometrySvg(deck, node);
  const strokeSvg = geoStroke || rectStrokeSvg(0, 0, w, h, rx, strokeSpec(node));
  const inner = geoStroke ? [strokeSvg, fillSvg].filter(Boolean).join("\n") : [fillSvg, strokeSvg].filter(Boolean).join("\n");
  if (!inner) return "";
  return `<g transform="${svgTransform(node)}">\n${inner}\n</g>`;
}

function renderFrameFast(deck, node) {
  const { w, h } = size(node);
  const radiiInfo = getNodeRadii(node);
  const rx = Math.min(node.cornerRadius ?? 0, w / 2, h / 2);
  const stroke = strokeSpec(node);
  const inner = childrenSvg(deck, node);
  const fills = getFillPaints(node)?.filter((p) => p.visible !== false) ?? [];
  const hasFill = fills.length > 0;
  let defs = "";
  let bg = "";
  const indepPath = radiiInfo.independent ? independentRoundedRectPath(0, 0, w, h, radiiInfo.radii) : null;
  if (indepPath && hasFill) {
    if (fills.length === 1 && fills[0].type === "SOLID") {
      bg = `<path d="${indepPath}" fill="${cssColor(fills[0].color ?? {}, fills[0].opacity ?? 1)}"/>`;
    } else {
      const stack = renderRoundedRectFillStack(deck, fills, w, h, 0);
      if (stack.bg) {
        const bgClipId = `frame-bg-clip-${++_svgIdSeq}`;
        defs = appendDefs(stack.defs, `<clipPath id="${bgClipId}"><path d="${indepPath}"/></clipPath>`);
        bg = `<g clip-path="url(#${bgClipId})">${stack.bg}</g>`;
      }
    }
  } else {
    const stack = renderRoundedRectFillStack(deck, fills, w, h, rx);
    defs = stack.defs;
    bg = stack.bg;
  }
  let clippedInner = inner;
  if (inner && node.frameMaskDisabled === false && _symbolDepth === 0 && hasFill) {
    const clipId = `frame-clip-${++_svgIdSeq}`;
    const clipShape = indepPath
      ? `<path d="${indepPath}"/>`
      : `<rect width="${w}" height="${h}" rx="${rx}" ry="${rx}"/>`;
    defs = appendDefs(defs, `<clipPath id="${clipId}">${clipShape}</clipPath>`);
    clippedInner = `<g clip-path="url(#${clipId})">${inner}</g>`;
  }
  const strokeSvg = frameStrokeSvgFast(node, w, h, rx, stroke);
  const parts = [defs, bg, clippedInner, strokeSvg].filter(Boolean).join("\n");
  if (!parts) return "";
  return `<g transform="${svgTransform(node)}">\n${parts}\n</g>`;
}

if (typeof RENDERERS === "object" && RENDERERS) {
  RENDERERS.VECTOR = renderVectorFast;
  RENDERERS.STAR = renderVectorFast;
  RENDERERS.REGULAR_POLYGON = renderVectorFast;
  RENDERERS.POLYGON = renderVectorFast;
  RENDERERS.BOOLEAN_OPERATION = renderBooleanOpFast;
  RENDERERS.ELLIPSE = renderEllipseFast;
  RENDERERS.ROUNDED_RECTANGLE = renderRectFast;
  RENDERERS.RECTANGLE = renderRectFast;
  RENDERERS.FRAME = renderFrameFast;
}

function resolveFrameScene(doc, targetNodeId) {
  const nodes = new Map();
  const children = new Map();
  const parentMap = new Map();
  let sequence = 0;
  const diagnostics = { propertiesApplied: 0, overridesApplied: 0, derivedApplied: 0, slotsResolved: 0, missingSymbols: [], unresolvedProperties: [], unrenderableNodes: [] };
  const guidKey = (guid) => guid ? `${guid.sessionID}:${guid.localID}` : null;
  const indexRecords = (records = []) => {
    const index = new Map();
    for (const record of records) {
      const key = (record.guidPath?.guids || []).map(guidKey).join("/");
      if (!index.has(key)) index.set(key, []);
      index.get(key).push(record);
    }
    return index;
  };
  const mergeAssignments = (original = [], incoming = []) => [...new Map(
    [...original, ...incoming].map((assignment) => [guidKey(assignment.defID), assignment]),
  ).values()];
  const propertyFields = { VISIBLE: "visible", TEXT_DATA: "textData", CHARACTERS: "textData", OPACITY: "opacity", OVERRIDDEN_SYMBOL_ID: "symbolID", SLOT_CONTENT_ID: "slotContentReference" };
  function definitionValue(key, seen = new Set()) {
    if (seen.has(key)) return undefined;
    seen.add(key);
    const definition = doc.componentDefinitions?.get(key);
    return definition?.varValue || (definition?.parentPropDefId ? definitionValue(guidKey(definition.parentPropDefId), seen) : undefined);
  }
  function propertyValue(variable, properties, seen = new Set()) {
    if (!variable) return undefined;
    const reference = variable.value?.propRefValue?.defId;
    if (reference) {
      const key = guidKey(reference);
      if (seen.has(key)) return undefined;
      seen.add(key);
      return propertyValue(properties.get(key) || definitionValue(key), properties, seen);
    }
    return variable.value;
  }
  function applyRecord(node, record, derived = false) {
    if (!record) return;
    if (Array.isArray(record)) {
      for (const entry of record) applyRecord(node, entry, derived);
      return;
    }
    for (const [field, value] of Object.entries(record)) {
      if (field === "guidPath") continue;
      if (field === "componentPropAssignments") node[field] = mergeAssignments(node[field], value);
      else if (field === "parameterConsumptionMap") node[field] = {
        ...node[field], ...value,
        entries: [...new Map([...(node[field]?.entries || []), ...(value?.entries || [])].map((entry) => [entry.variableField, entry])).values()],
      };
      else if (field === "overriddenSymbolID") node.symbolData = { ...node.symbolData, symbolID: value };
      else node[field] = value;
    }
    diagnostics[derived ? "derivedApplied" : "overridesApplied"] += 1;
  }
  function matchedRecord(scope, table, node) {
    for (const key of [guidKey(node.overrideKey), guidKey(node.guid)].filter(Boolean)) {
      const record = scope[table].get([...scope.prefix, key].join("/"));
      if (record) return record;
    }
    return null;
  }
  function applyScopes(node, raw, scopes, table) {
    for (const scope of scopes) applyRecord(node, matchedRecord(scope, table, raw), table === "derived");
  }
  function consumeProperties(node, properties) {
    for (const binding of node.parameterConsumptionMap?.entries || []) {
      if (!binding.variableData?.value?.propRefValue) continue;
      const value = propertyValue(binding.variableData, properties);
      const field = propertyFields[binding.variableField];
      if (!value || !field) {
        diagnostics.unresolvedProperties.push({ node: guidKey(node.guid), field: binding.variableField });
        continue;
      }
      if (field === "textData" && value.textDataValue) node.textData = { ...node.textData, ...value.textDataValue };
      else if (field === "visible" && typeof value.boolValue === "boolean") node.visible = value.boolValue;
      else if (field === "opacity" && typeof value.floatValue === "number") node.opacity = value.floatValue;
      else if (field === "symbolID" && value.symbolIdValue?.guid) node.symbolData = { ...node.symbolData, symbolID: value.symbolIdValue.guid };
      else if (field === "slotContentReference" && value.slotContentIdValue?.guid) node.slotContentReference = guidKey(value.slotContentIdValue.guid);
      else continue;
      diagnostics.propertiesApplied += 1;
    }
  }
  function expand(raw, scopes, properties, parentGuid, instancePath, symbolStack, depth = 0) {
    if (depth > 100 || nodes.size > 150000) throw new Error("Component expansion exceeds the scene safety limit.");
    let node = { ...raw };
    const originalText = node.textData?.characters;
    const originalDerived = node.derivedTextData;
    applyScopes(node, raw, scopes, "overrides");
    consumeProperties(node, properties);
    applyScopes(node, raw, scopes, "overrides");
    let nextScopes = scopes;
    let nextProperties = properties;
    let descendants = doc.children.get(guidKey(raw.guid)) || [];
    let nextStack = symbolStack;
    let nextPath = instancePath;
    const slot = doc.nodes.get(node.slotContentReference);
    if (slot && slot !== raw) {
      node = { ...node, ...slot, guid: raw.guid, transform: node.transform };
      descendants = doc.children.get(node.slotContentReference) || [];
      diagnostics.slotsResolved += 1;
    }
    if (node.type === "INSTANCE") {
      const symbolId = guidKey(node.symbolData?.symbolID);
      const symbol = doc.nodes.get(symbolId);
      if (!symbol || symbolStack.has(symbolId)) {
        diagnostics.missingSymbols.push({ instance: guidKey(raw.guid), symbol: symbolId });
      } else {
        nextStack = new Set(symbolStack).add(symbolId);
        const ownScope = {
          prefix: [], overrides: indexRecords(node.symbolData?.symbolOverrides),
          derived: indexRecords(node.derivedSymbolData),
        };
        const instance = node;
        const replaced = symbolId !== guidKey(raw.symbolData?.symbolID);
        const instanceFields = replaced ? Object.fromEntries([
          "guid", "parentIndex", "overrideKey", "name", "visible", "opacity", "transform", "size",
          "symbolData", "derivedSymbolData", "componentPropAssignments",
        ].filter((field) => Object.hasOwn(instance, field)).map((field) => [field, instance[field]])) : instance;
        node = { ...symbol, type: "FRAME" };
        applyRecord(node, matchedRecord(ownScope, "overrides", symbol));
        applyRecord(node, instanceFields);
        node.type = "FRAME";
        applyScopes(node, raw, scopes, "overrides");
        node.transform = instance.transform;
        node.size = instance.size || symbol.size;
        node.visible = instance.visible;
        nextProperties = new Map(properties);
        for (const definition of symbol.componentPropDefs || []) {
          const key = guidKey(definition.id);
          const value = definition.varValue || definitionValue(key);
          if (value) nextProperties.set(key, value);
        }
        for (const assignment of node.componentPropAssignments || []) {
          const resolved = propertyValue(assignment.varValue, properties);
          nextProperties.set(guidKey(assignment.defID), resolved ? { ...assignment.varValue, value: resolved } : assignment.varValue);
        }
        applyRecord(node, matchedRecord(ownScope, "derived", symbol), true);
        nextScopes = [ownScope, ...scopes.map((scope) => ({
          ...scope, prefix: [...scope.prefix, guidKey(raw.overrideKey) || guidKey(raw.guid)],
        }))];
        nextPath = [...instancePath, guidKey(raw.overrideKey) || guidKey(raw.guid)];
        descendants = doc.children.get(symbolId) || [];
      }
    }
    applyScopes(node, raw, scopes, "derived");
    if (node.textData?.characters !== originalText && node.derivedTextData === originalDerived) node.derivedTextData = undefined;
    if (node.type === "SYMBOL" || node.type === "COMPONENT") node.type = "FRAME";
    const radii = getNodeRadii(node);
    if (!radii.independent) node.cornerRadius = radii.uniform;
    const sceneGuid = { sessionID: `scene/${targetNodeId}`, localID: ++sequence };
    node = { ...node, guid: sceneGuid, originalNodeId: guidKey(raw.guid), instancePath: [...instancePath], parentIndex: { guid: parentGuid } };
    const key = guidKey(sceneGuid);
    nodes.set(key, node);
    if (parentGuid) parentMap.set(key, guidKey(parentGuid));
    const expandedChildren = [];
    children.set(key, expandedChildren);
    if (node.visible !== false) {
      for (const child of descendants) expandedChildren.push(expand(child, nextScopes, nextProperties, sceneGuid, nextPath, nextStack, depth + 1));
    }
    return node;
  }
  const rawTarget = doc.nodes.get(targetNodeId);
  if (!rawTarget) throw new Error("Frame not found.");
  const root = expand(rawTarget, [], new Map(), null, [], new Set());
  root.transform = { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 };
  if (root.type === "SYMBOL" || root.type === "COMPONENT") root.type = "FRAME";
  return { root, nodes, children, parentMap, diagnostics, frameId: targetNodeId };
}

function renderFrameEnhanced(doc, targetNodeId, options = {}) {
  const t0 = typeof performance !== "undefined" ? performance.now() : Date.now();
  const original = doc.nodes.get(targetNodeId);
  if (!original) throw new Error("未找到指定画板或节点：" + targetNodeId);
  const width = Math.ceil(original.size?.x ?? 0);
  const height = Math.ceil(original.size?.y ?? 0);
  if (!(width > 0 && height > 0) || width > 30000 || height > 30000) {
    throw new Error("请选择尺寸大于 0 且单边不超过 30,000 px 的可视节点。");
  }

  const useGlyphOutlines = options.useGlyphOutlines !== false;
  const scene = resolveFrameScene(doc, targetNodeId);
  if (options.rememberScene !== false) doc.renderScene = scene;
  const counts = { visited: 0, outlinedText: 0, fallbackText: 0, emptyGlyphs: 0 };
  const hitBoxes = [];
  const ROOT_ID = "2147483647:2147483647";

  const getClonedNode = (key) => scene.nodes.get(key);
  const target = scene.root;

  // Collect hit-testing boxes in frame-local coordinates by walking the visible hierarchy
  function collectHitBoxes(node, parentMatrix, depth) {
    if (!node || node.phase === "REMOVED" || node.visible === false) return;
    const id = nodeId(node);
    if (!id) return;
    const localMat =
      id === targetNodeId
        ? { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }
        : {
            m00: node.transform?.m00 ?? 1,
            m01: node.transform?.m01 ?? 0,
            m02: node.transform?.m02 ?? 0,
            m10: node.transform?.m10 ?? 0,
            m11: node.transform?.m11 ?? 1,
            m12: node.transform?.m12 ?? 0
          };
    const worldMat = multiplyAffine(parentMatrix, localMat);
    const nw = node.size?.x ?? 0;
    const nh = node.size?.y ?? 0;
    if (nw > 0 && nh > 0 && hitBoxes.length < 4000) {
      const box = transformBBox(worldMat, nw, nh);
      if (box.w >= 1 && box.h >= 1) {
        hitBoxes.push({
          id: node === target ? targetNodeId : id,
          sourceId: node.originalNodeId,
          instancePath: node.instancePath,
          name: node.name || node.type,
          type: node.type,
          x: box.x,
          y: box.y,
          w: box.w,
          h: box.h,
          depth,
          text: node.textData?.characters ? node.textData.characters.slice(0, 120) : null
        });
      }
    }
    if (depth > 24) return;
    const rawChildren = scene.children.get(id) ?? [];
    for (const child of rawChildren) {
      if (child.visible === false || child.phase === "REMOVED") continue;
      collectHitBoxes(child, worldMat, depth + 1);
    }
  }

  collectHitBoxes(target, { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }, 0);

  const root = {
    guid: { sessionID: 2147483647, localID: 2147483647 },
    size: { x: width, y: height }
  };

  const adapter = {
    message: doc.parsed.message,
    imagesDir: "memory-only",
    getNode: getClonedNode,
    getChildren(key) {
      if (key === ROOT_ID) return [target];
      return (scene.children.get(key) ?? [])
        .map((n) => getClonedNode(nodeId(n)))
        .filter((n) => n && n.visible !== false);
    },
    readImage(hash) {
      if (typeof hash !== "string") throw new Error("无效的图片资源标识。");
      const bytes = doc.parsed.images.get(hash);
      if (!bytes) throw new Error(`缺少内嵌图片资源 ${hash}`);
      // Provide a Uint8Array with .toString('base64') compatibility for openfig svg-builder
      const view = new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      view.toString = function (encoding) {
        if (encoding === "base64") return uint8ToBase64(view);
        return new TextDecoder().decode(view);
      };
      return view;
    },
    renderGlyphOutlines(node) {
      if (!useGlyphOutlines) return null;
      return renderGlyphOutlinesFast(doc, node, counts);
    },
    reportPlaceholder(node) {
      scene.diagnostics.unrenderableNodes.push({ sourceId: node.originalNodeId, type: node.type, name: node.name });
    },
    visit() {
      counts.visited += 1;
      if (counts.visited > 150000) throw new Error("画板节点复杂度超过单次安全渲染上限。");
    }
  };

  const svg = frameToSvg(adapter, root);
  const t1 = typeof performance !== "undefined" ? performance.now() : Date.now();
  const renderMs = Math.max(1, Math.round(t1 - t0));

  return {
    svg,
    width,
    height,
    nodeId: targetNodeId,
    name: original.name || original.type,
    type: original.type,
    renderMs,
    hitBoxes,
    resolution: scene.diagnostics,
    resolvedText: options.includeResolvedText ? [...scene.nodes.values()].filter((node) => node.visible !== false && node.type === "TEXT").map((node) => ({ sourceId: node.originalNodeId, instancePath: node.instancePath, text: node.textData?.characters, glyphs: node.derivedTextData?.glyphs?.length || 0 })) : undefined,
    ...counts
  };
}


// FigFig Worker Dispatcher (supports both Browser Web Worker and Node.js test/benchmark import)

const documents = new Map();

async function sha256HexInBrowser(bytes) {
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const hashBuffer = await crypto.subtle.digest("SHA-256", bytes);
    const hashArray = new Uint8Array(hashBuffer);
    let hex = "";
    for (let i = 0; i < hashArray.length; i++) {
      hex += hashArray[i].toString(16).padStart(2, "0");
    }
    return hex;
  }
  return "";
}

function getDocOrThrow(docId) {
  const doc = documents.get(docId || "default");
  if (!doc) throw new Error("当前标签页未加载设计文档。");
  return doc;
}

async function handleWorkerRequest(operation, args = {}) {
  const docId = args.docId || "default";

  if (operation === "loadUrl") {
    const resp = await fetch(args.url);
    if (!resp.ok) {
      throw new Error(`读取本地文件流失败 (HTTP ${resp.status})`);
    }
    const buf = await resp.arrayBuffer();
    const bytes = new Uint8Array(buf);
    const sha256 = await sha256HexInBrowser(bytes);
    if (args.sha256 && sha256 !== args.sha256) throw new Error("File changed between selection and read. Reopen the file.");
    const doc = parseDocumentFast(bytes, {
      fileName: args.fileName || "Design.fig",
      sha256
    });
    documents.set(docId, doc);
    return getDocumentSummary(doc);
  }

  if (operation === "loadBytes") {
    const bytes =
      args.bytes instanceof Uint8Array
        ? args.bytes
        : new Uint8Array(args.bytes);
    const sha256 = args.sha256 || (await sha256HexInBrowser(bytes));
    const doc = parseDocumentFast(bytes, {
      fileName: args.fileName || "Design.fig",
      sha256
    });
    documents.set(docId, doc);
    return getDocumentSummary(doc);
  }

  if (operation === "closeDoc") {
    documents.delete(docId);
    return { closed: true, docId };
  }

  const doc = getDocOrThrow(docId);

  switch (operation) {
    case "summary":
      return getDocumentSummary(doc);

    case "pages":
      return getPagesList(doc, args);

    case "frames":
      return getFramesOnPage(doc, args.pageId, args);

    case "children":
      return getChildrenOfNode(doc, args.nodeId, args);

    case "node":
      return getNodeDetail(doc, args.nodeId, args);

    case "search":
      return searchNodesFast(doc, args.query, args);

    case "compatibility":
      return getCompatibilityReport(doc);

    case "thumbnail": {
      if (!doc.parsed.thumbnail) return null;
      const b64 = uint8ToBase64(doc.parsed.thumbnail);
      return `data:image/png;base64,${b64}`;
    }

    case "render": {
      const rendered = renderFrameEnhanced(doc, args.nodeId, {
        useGlyphOutlines: args.useGlyphOutlines !== false
      });
      const svgBytes = new TextEncoder().encode(rendered.svg);
      const uri = `data:image/svg+xml;base64,${uint8ToBase64(svgBytes)}`;
      return {
        ...rendered,
        svg: args.includeRawSvg ? rendered.svg : undefined,
        uri
      };
    }

    case "exportSvg": {
      const rendered = renderFrameEnhanced(doc, args.nodeId, {
        useGlyphOutlines: args.useGlyphOutlines !== false,
        rememberScene: false
      });
      return {
        nodeId: args.nodeId,
        name: rendered.name,
        width: rendered.width,
        height: rendered.height,
        svg: rendered.svg
      };
    }

    case "batchThumbnails": {
      const ids = Array.isArray(args.nodeIds) ? args.nodeIds.slice(0, 24) : [];
      const items = [];
      for (const id of ids) {
        try {
          const rendered = renderFrameEnhanced(doc, id, {
            useGlyphOutlines: args.useGlyphOutlines !== false,
            rememberScene: false
          });
          const svgBytes = new TextEncoder().encode(rendered.svg);
          items.push({
            id,
            name: rendered.name,
            width: rendered.width,
            height: rendered.height,
            renderMs: rendered.renderMs,
            visited: rendered.visited,
            uri: `data:image/svg+xml;base64,${uint8ToBase64(svgBytes)}`
          });
        } catch (err) {
          items.push({
            id,
            error: err instanceof Error ? err.message : String(err)
          });
        }
      }
      return { items };
    }

    case "listAssets": {
      return {
        total: doc.imageAssets.length,
        items: doc.imageAssets
      };
    }

    case "getAssetData": {
      const bytes = doc.parsed.images.get(args.hash);
      if (!bytes) throw new Error(`未找到原图资源：${args.hash}`);
      const info = inspectImageHeader(bytes);
      const base64 = uint8ToBase64(bytes);
      return {
        hash: args.hash,
        byteLength: bytes.byteLength,
        mime: info.mime,
        ext: info.ext,
        width: info.width,
        height: info.height,
        base64,
        dataUri: `data:${info.mime};base64,${base64}`
      };
    }

    default:
      throw new Error(`未知引擎操作：${operation}`);
  }
}

if (typeof self !== "undefined" && typeof self.postMessage === "function") {
  self.onmessage = async (event) => {
    const message = event.data;
    if (!message || !message.id) return;
    try {
      const result = await handleWorkerRequest(message.operation, message.args || {});
      self.postMessage({ id: message.id, ok: true, result });
    } catch (error) {
      self.postMessage({
        id: message.id,
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    handleWorkerRequest,
    parseDocumentFast,
    decodeCmdBlobFast,
    renderFrameEnhanced,
    getFramesOnPage,
    getPagesList,
    getNodeDetail,
    searchNodesFast,
    getCompatibilityReport
  };
}
