/* Собран tools/build-web-ide.js (esbuild) из packages/web-ide/src/ — править источники, не этот файл. */
"use strict";
(() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __commonJS = (cb, mod) => function __require() {
    try {
      return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
    } catch (e) {
      throw mod = 0, e;
    }
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

  // node_modules/pako/lib/utils/common.js
  var require_common = __commonJS({
    "node_modules/pako/lib/utils/common.js"(exports) {
      "use strict";
      var TYPED_OK = typeof Uint8Array !== "undefined" && typeof Uint16Array !== "undefined" && typeof Int32Array !== "undefined";
      function _has(obj, key) {
        return Object.prototype.hasOwnProperty.call(obj, key);
      }
      exports.assign = function(obj) {
        var sources = Array.prototype.slice.call(arguments, 1);
        while (sources.length) {
          var source = sources.shift();
          if (!source) {
            continue;
          }
          if (typeof source !== "object") {
            throw new TypeError(source + "must be non-object");
          }
          for (var p in source) {
            if (_has(source, p)) {
              obj[p] = source[p];
            }
          }
        }
        return obj;
      };
      exports.shrinkBuf = function(buf, size) {
        if (buf.length === size) {
          return buf;
        }
        if (buf.subarray) {
          return buf.subarray(0, size);
        }
        buf.length = size;
        return buf;
      };
      var fnTyped = {
        arraySet: function(dest, src, src_offs, len, dest_offs) {
          if (src.subarray && dest.subarray) {
            dest.set(src.subarray(src_offs, src_offs + len), dest_offs);
            return;
          }
          for (var i = 0; i < len; i++) {
            dest[dest_offs + i] = src[src_offs + i];
          }
        },
        // Join array of chunks to single array.
        flattenChunks: function(chunks) {
          var i, l, len, pos, chunk, result;
          len = 0;
          for (i = 0, l = chunks.length; i < l; i++) {
            len += chunks[i].length;
          }
          result = new Uint8Array(len);
          pos = 0;
          for (i = 0, l = chunks.length; i < l; i++) {
            chunk = chunks[i];
            result.set(chunk, pos);
            pos += chunk.length;
          }
          return result;
        }
      };
      var fnUntyped = {
        arraySet: function(dest, src, src_offs, len, dest_offs) {
          for (var i = 0; i < len; i++) {
            dest[dest_offs + i] = src[src_offs + i];
          }
        },
        // Join array of chunks to single array.
        flattenChunks: function(chunks) {
          return [].concat.apply([], chunks);
        }
      };
      exports.setTyped = function(on) {
        if (on) {
          exports.Buf8 = Uint8Array;
          exports.Buf16 = Uint16Array;
          exports.Buf32 = Int32Array;
          exports.assign(exports, fnTyped);
        } else {
          exports.Buf8 = Array;
          exports.Buf16 = Array;
          exports.Buf32 = Array;
          exports.assign(exports, fnUntyped);
        }
      };
      exports.setTyped(TYPED_OK);
    }
  });

  // node_modules/pako/lib/zlib/trees.js
  var require_trees = __commonJS({
    "node_modules/pako/lib/zlib/trees.js"(exports) {
      "use strict";
      var utils = require_common();
      var Z_FIXED = 4;
      var Z_BINARY = 0;
      var Z_TEXT = 1;
      var Z_UNKNOWN = 2;
      function zero(buf) {
        var len = buf.length;
        while (--len >= 0) {
          buf[len] = 0;
        }
      }
      var STORED_BLOCK = 0;
      var STATIC_TREES = 1;
      var DYN_TREES = 2;
      var MIN_MATCH = 3;
      var MAX_MATCH = 258;
      var LENGTH_CODES = 29;
      var LITERALS = 256;
      var L_CODES = LITERALS + 1 + LENGTH_CODES;
      var D_CODES = 30;
      var BL_CODES = 19;
      var HEAP_SIZE = 2 * L_CODES + 1;
      var MAX_BITS = 15;
      var Buf_size = 16;
      var MAX_BL_BITS = 7;
      var END_BLOCK = 256;
      var REP_3_6 = 16;
      var REPZ_3_10 = 17;
      var REPZ_11_138 = 18;
      var extra_lbits = (
        /* extra bits for each length code */
        [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0]
      );
      var extra_dbits = (
        /* extra bits for each distance code */
        [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13]
      );
      var extra_blbits = (
        /* extra bits for each bit length code */
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 3, 7]
      );
      var bl_order = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];
      var DIST_CODE_LEN = 512;
      var static_ltree = new Array((L_CODES + 2) * 2);
      zero(static_ltree);
      var static_dtree = new Array(D_CODES * 2);
      zero(static_dtree);
      var _dist_code = new Array(DIST_CODE_LEN);
      zero(_dist_code);
      var _length_code = new Array(MAX_MATCH - MIN_MATCH + 1);
      zero(_length_code);
      var base_length = new Array(LENGTH_CODES);
      zero(base_length);
      var base_dist = new Array(D_CODES);
      zero(base_dist);
      function StaticTreeDesc(static_tree, extra_bits, extra_base, elems, max_length) {
        this.static_tree = static_tree;
        this.extra_bits = extra_bits;
        this.extra_base = extra_base;
        this.elems = elems;
        this.max_length = max_length;
        this.has_stree = static_tree && static_tree.length;
      }
      var static_l_desc;
      var static_d_desc;
      var static_bl_desc;
      function TreeDesc(dyn_tree, stat_desc) {
        this.dyn_tree = dyn_tree;
        this.max_code = 0;
        this.stat_desc = stat_desc;
      }
      function d_code(dist) {
        return dist < 256 ? _dist_code[dist] : _dist_code[256 + (dist >>> 7)];
      }
      function put_short(s, w) {
        s.pending_buf[s.pending++] = w & 255;
        s.pending_buf[s.pending++] = w >>> 8 & 255;
      }
      function send_bits(s, value, length) {
        if (s.bi_valid > Buf_size - length) {
          s.bi_buf |= value << s.bi_valid & 65535;
          put_short(s, s.bi_buf);
          s.bi_buf = value >> Buf_size - s.bi_valid;
          s.bi_valid += length - Buf_size;
        } else {
          s.bi_buf |= value << s.bi_valid & 65535;
          s.bi_valid += length;
        }
      }
      function send_code(s, c, tree) {
        send_bits(
          s,
          tree[c * 2],
          tree[c * 2 + 1]
          /*.Len*/
        );
      }
      function bi_reverse(code, len) {
        var res = 0;
        do {
          res |= code & 1;
          code >>>= 1;
          res <<= 1;
        } while (--len > 0);
        return res >>> 1;
      }
      function bi_flush(s) {
        if (s.bi_valid === 16) {
          put_short(s, s.bi_buf);
          s.bi_buf = 0;
          s.bi_valid = 0;
        } else if (s.bi_valid >= 8) {
          s.pending_buf[s.pending++] = s.bi_buf & 255;
          s.bi_buf >>= 8;
          s.bi_valid -= 8;
        }
      }
      function gen_bitlen(s, desc) {
        var tree = desc.dyn_tree;
        var max_code = desc.max_code;
        var stree = desc.stat_desc.static_tree;
        var has_stree = desc.stat_desc.has_stree;
        var extra = desc.stat_desc.extra_bits;
        var base = desc.stat_desc.extra_base;
        var max_length = desc.stat_desc.max_length;
        var h;
        var n, m;
        var bits;
        var xbits;
        var f;
        var overflow = 0;
        for (bits = 0; bits <= MAX_BITS; bits++) {
          s.bl_count[bits] = 0;
        }
        tree[s.heap[s.heap_max] * 2 + 1] = 0;
        for (h = s.heap_max + 1; h < HEAP_SIZE; h++) {
          n = s.heap[h];
          bits = tree[tree[n * 2 + 1] * 2 + 1] + 1;
          if (bits > max_length) {
            bits = max_length;
            overflow++;
          }
          tree[n * 2 + 1] = bits;
          if (n > max_code) {
            continue;
          }
          s.bl_count[bits]++;
          xbits = 0;
          if (n >= base) {
            xbits = extra[n - base];
          }
          f = tree[n * 2];
          s.opt_len += f * (bits + xbits);
          if (has_stree) {
            s.static_len += f * (stree[n * 2 + 1] + xbits);
          }
        }
        if (overflow === 0) {
          return;
        }
        do {
          bits = max_length - 1;
          while (s.bl_count[bits] === 0) {
            bits--;
          }
          s.bl_count[bits]--;
          s.bl_count[bits + 1] += 2;
          s.bl_count[max_length]--;
          overflow -= 2;
        } while (overflow > 0);
        for (bits = max_length; bits !== 0; bits--) {
          n = s.bl_count[bits];
          while (n !== 0) {
            m = s.heap[--h];
            if (m > max_code) {
              continue;
            }
            if (tree[m * 2 + 1] !== bits) {
              s.opt_len += (bits - tree[m * 2 + 1]) * tree[m * 2];
              tree[m * 2 + 1] = bits;
            }
            n--;
          }
        }
      }
      function gen_codes(tree, max_code, bl_count) {
        var next_code = new Array(MAX_BITS + 1);
        var code = 0;
        var bits;
        var n;
        for (bits = 1; bits <= MAX_BITS; bits++) {
          next_code[bits] = code = code + bl_count[bits - 1] << 1;
        }
        for (n = 0; n <= max_code; n++) {
          var len = tree[n * 2 + 1];
          if (len === 0) {
            continue;
          }
          tree[n * 2] = bi_reverse(next_code[len]++, len);
        }
      }
      function tr_static_init() {
        var n;
        var bits;
        var length;
        var code;
        var dist;
        var bl_count = new Array(MAX_BITS + 1);
        length = 0;
        for (code = 0; code < LENGTH_CODES - 1; code++) {
          base_length[code] = length;
          for (n = 0; n < 1 << extra_lbits[code]; n++) {
            _length_code[length++] = code;
          }
        }
        _length_code[length - 1] = code;
        dist = 0;
        for (code = 0; code < 16; code++) {
          base_dist[code] = dist;
          for (n = 0; n < 1 << extra_dbits[code]; n++) {
            _dist_code[dist++] = code;
          }
        }
        dist >>= 7;
        for (; code < D_CODES; code++) {
          base_dist[code] = dist << 7;
          for (n = 0; n < 1 << extra_dbits[code] - 7; n++) {
            _dist_code[256 + dist++] = code;
          }
        }
        for (bits = 0; bits <= MAX_BITS; bits++) {
          bl_count[bits] = 0;
        }
        n = 0;
        while (n <= 143) {
          static_ltree[n * 2 + 1] = 8;
          n++;
          bl_count[8]++;
        }
        while (n <= 255) {
          static_ltree[n * 2 + 1] = 9;
          n++;
          bl_count[9]++;
        }
        while (n <= 279) {
          static_ltree[n * 2 + 1] = 7;
          n++;
          bl_count[7]++;
        }
        while (n <= 287) {
          static_ltree[n * 2 + 1] = 8;
          n++;
          bl_count[8]++;
        }
        gen_codes(static_ltree, L_CODES + 1, bl_count);
        for (n = 0; n < D_CODES; n++) {
          static_dtree[n * 2 + 1] = 5;
          static_dtree[n * 2] = bi_reverse(n, 5);
        }
        static_l_desc = new StaticTreeDesc(static_ltree, extra_lbits, LITERALS + 1, L_CODES, MAX_BITS);
        static_d_desc = new StaticTreeDesc(static_dtree, extra_dbits, 0, D_CODES, MAX_BITS);
        static_bl_desc = new StaticTreeDesc(new Array(0), extra_blbits, 0, BL_CODES, MAX_BL_BITS);
      }
      function init_block(s) {
        var n;
        for (n = 0; n < L_CODES; n++) {
          s.dyn_ltree[n * 2] = 0;
        }
        for (n = 0; n < D_CODES; n++) {
          s.dyn_dtree[n * 2] = 0;
        }
        for (n = 0; n < BL_CODES; n++) {
          s.bl_tree[n * 2] = 0;
        }
        s.dyn_ltree[END_BLOCK * 2] = 1;
        s.opt_len = s.static_len = 0;
        s.last_lit = s.matches = 0;
      }
      function bi_windup(s) {
        if (s.bi_valid > 8) {
          put_short(s, s.bi_buf);
        } else if (s.bi_valid > 0) {
          s.pending_buf[s.pending++] = s.bi_buf;
        }
        s.bi_buf = 0;
        s.bi_valid = 0;
      }
      function copy_block(s, buf, len, header) {
        bi_windup(s);
        if (header) {
          put_short(s, len);
          put_short(s, ~len);
        }
        utils.arraySet(s.pending_buf, s.window, buf, len, s.pending);
        s.pending += len;
      }
      function smaller(tree, n, m, depth) {
        var _n2 = n * 2;
        var _m2 = m * 2;
        return tree[_n2] < tree[_m2] || tree[_n2] === tree[_m2] && depth[n] <= depth[m];
      }
      function pqdownheap(s, tree, k) {
        var v = s.heap[k];
        var j = k << 1;
        while (j <= s.heap_len) {
          if (j < s.heap_len && smaller(tree, s.heap[j + 1], s.heap[j], s.depth)) {
            j++;
          }
          if (smaller(tree, v, s.heap[j], s.depth)) {
            break;
          }
          s.heap[k] = s.heap[j];
          k = j;
          j <<= 1;
        }
        s.heap[k] = v;
      }
      function compress_block(s, ltree, dtree) {
        var dist;
        var lc;
        var lx = 0;
        var code;
        var extra;
        if (s.last_lit !== 0) {
          do {
            dist = s.pending_buf[s.d_buf + lx * 2] << 8 | s.pending_buf[s.d_buf + lx * 2 + 1];
            lc = s.pending_buf[s.l_buf + lx];
            lx++;
            if (dist === 0) {
              send_code(s, lc, ltree);
            } else {
              code = _length_code[lc];
              send_code(s, code + LITERALS + 1, ltree);
              extra = extra_lbits[code];
              if (extra !== 0) {
                lc -= base_length[code];
                send_bits(s, lc, extra);
              }
              dist--;
              code = d_code(dist);
              send_code(s, code, dtree);
              extra = extra_dbits[code];
              if (extra !== 0) {
                dist -= base_dist[code];
                send_bits(s, dist, extra);
              }
            }
          } while (lx < s.last_lit);
        }
        send_code(s, END_BLOCK, ltree);
      }
      function build_tree(s, desc) {
        var tree = desc.dyn_tree;
        var stree = desc.stat_desc.static_tree;
        var has_stree = desc.stat_desc.has_stree;
        var elems = desc.stat_desc.elems;
        var n, m;
        var max_code = -1;
        var node;
        s.heap_len = 0;
        s.heap_max = HEAP_SIZE;
        for (n = 0; n < elems; n++) {
          if (tree[n * 2] !== 0) {
            s.heap[++s.heap_len] = max_code = n;
            s.depth[n] = 0;
          } else {
            tree[n * 2 + 1] = 0;
          }
        }
        while (s.heap_len < 2) {
          node = s.heap[++s.heap_len] = max_code < 2 ? ++max_code : 0;
          tree[node * 2] = 1;
          s.depth[node] = 0;
          s.opt_len--;
          if (has_stree) {
            s.static_len -= stree[node * 2 + 1];
          }
        }
        desc.max_code = max_code;
        for (n = s.heap_len >> 1; n >= 1; n--) {
          pqdownheap(s, tree, n);
        }
        node = elems;
        do {
          n = s.heap[
            1
            /*SMALLEST*/
          ];
          s.heap[
            1
            /*SMALLEST*/
          ] = s.heap[s.heap_len--];
          pqdownheap(
            s,
            tree,
            1
            /*SMALLEST*/
          );
          m = s.heap[
            1
            /*SMALLEST*/
          ];
          s.heap[--s.heap_max] = n;
          s.heap[--s.heap_max] = m;
          tree[node * 2] = tree[n * 2] + tree[m * 2];
          s.depth[node] = (s.depth[n] >= s.depth[m] ? s.depth[n] : s.depth[m]) + 1;
          tree[n * 2 + 1] = tree[m * 2 + 1] = node;
          s.heap[
            1
            /*SMALLEST*/
          ] = node++;
          pqdownheap(
            s,
            tree,
            1
            /*SMALLEST*/
          );
        } while (s.heap_len >= 2);
        s.heap[--s.heap_max] = s.heap[
          1
          /*SMALLEST*/
        ];
        gen_bitlen(s, desc);
        gen_codes(tree, max_code, s.bl_count);
      }
      function scan_tree(s, tree, max_code) {
        var n;
        var prevlen = -1;
        var curlen;
        var nextlen = tree[0 * 2 + 1];
        var count = 0;
        var max_count = 7;
        var min_count = 4;
        if (nextlen === 0) {
          max_count = 138;
          min_count = 3;
        }
        tree[(max_code + 1) * 2 + 1] = 65535;
        for (n = 0; n <= max_code; n++) {
          curlen = nextlen;
          nextlen = tree[(n + 1) * 2 + 1];
          if (++count < max_count && curlen === nextlen) {
            continue;
          } else if (count < min_count) {
            s.bl_tree[curlen * 2] += count;
          } else if (curlen !== 0) {
            if (curlen !== prevlen) {
              s.bl_tree[curlen * 2]++;
            }
            s.bl_tree[REP_3_6 * 2]++;
          } else if (count <= 10) {
            s.bl_tree[REPZ_3_10 * 2]++;
          } else {
            s.bl_tree[REPZ_11_138 * 2]++;
          }
          count = 0;
          prevlen = curlen;
          if (nextlen === 0) {
            max_count = 138;
            min_count = 3;
          } else if (curlen === nextlen) {
            max_count = 6;
            min_count = 3;
          } else {
            max_count = 7;
            min_count = 4;
          }
        }
      }
      function send_tree(s, tree, max_code) {
        var n;
        var prevlen = -1;
        var curlen;
        var nextlen = tree[0 * 2 + 1];
        var count = 0;
        var max_count = 7;
        var min_count = 4;
        if (nextlen === 0) {
          max_count = 138;
          min_count = 3;
        }
        for (n = 0; n <= max_code; n++) {
          curlen = nextlen;
          nextlen = tree[(n + 1) * 2 + 1];
          if (++count < max_count && curlen === nextlen) {
            continue;
          } else if (count < min_count) {
            do {
              send_code(s, curlen, s.bl_tree);
            } while (--count !== 0);
          } else if (curlen !== 0) {
            if (curlen !== prevlen) {
              send_code(s, curlen, s.bl_tree);
              count--;
            }
            send_code(s, REP_3_6, s.bl_tree);
            send_bits(s, count - 3, 2);
          } else if (count <= 10) {
            send_code(s, REPZ_3_10, s.bl_tree);
            send_bits(s, count - 3, 3);
          } else {
            send_code(s, REPZ_11_138, s.bl_tree);
            send_bits(s, count - 11, 7);
          }
          count = 0;
          prevlen = curlen;
          if (nextlen === 0) {
            max_count = 138;
            min_count = 3;
          } else if (curlen === nextlen) {
            max_count = 6;
            min_count = 3;
          } else {
            max_count = 7;
            min_count = 4;
          }
        }
      }
      function build_bl_tree(s) {
        var max_blindex;
        scan_tree(s, s.dyn_ltree, s.l_desc.max_code);
        scan_tree(s, s.dyn_dtree, s.d_desc.max_code);
        build_tree(s, s.bl_desc);
        for (max_blindex = BL_CODES - 1; max_blindex >= 3; max_blindex--) {
          if (s.bl_tree[bl_order[max_blindex] * 2 + 1] !== 0) {
            break;
          }
        }
        s.opt_len += 3 * (max_blindex + 1) + 5 + 5 + 4;
        return max_blindex;
      }
      function send_all_trees(s, lcodes, dcodes, blcodes) {
        var rank;
        send_bits(s, lcodes - 257, 5);
        send_bits(s, dcodes - 1, 5);
        send_bits(s, blcodes - 4, 4);
        for (rank = 0; rank < blcodes; rank++) {
          send_bits(s, s.bl_tree[bl_order[rank] * 2 + 1], 3);
        }
        send_tree(s, s.dyn_ltree, lcodes - 1);
        send_tree(s, s.dyn_dtree, dcodes - 1);
      }
      function detect_data_type(s) {
        var black_mask = 4093624447;
        var n;
        for (n = 0; n <= 31; n++, black_mask >>>= 1) {
          if (black_mask & 1 && s.dyn_ltree[n * 2] !== 0) {
            return Z_BINARY;
          }
        }
        if (s.dyn_ltree[9 * 2] !== 0 || s.dyn_ltree[10 * 2] !== 0 || s.dyn_ltree[13 * 2] !== 0) {
          return Z_TEXT;
        }
        for (n = 32; n < LITERALS; n++) {
          if (s.dyn_ltree[n * 2] !== 0) {
            return Z_TEXT;
          }
        }
        return Z_BINARY;
      }
      var static_init_done = false;
      function _tr_init(s) {
        if (!static_init_done) {
          tr_static_init();
          static_init_done = true;
        }
        s.l_desc = new TreeDesc(s.dyn_ltree, static_l_desc);
        s.d_desc = new TreeDesc(s.dyn_dtree, static_d_desc);
        s.bl_desc = new TreeDesc(s.bl_tree, static_bl_desc);
        s.bi_buf = 0;
        s.bi_valid = 0;
        init_block(s);
      }
      function _tr_stored_block(s, buf, stored_len, last) {
        send_bits(s, (STORED_BLOCK << 1) + (last ? 1 : 0), 3);
        copy_block(s, buf, stored_len, true);
      }
      function _tr_align(s) {
        send_bits(s, STATIC_TREES << 1, 3);
        send_code(s, END_BLOCK, static_ltree);
        bi_flush(s);
      }
      function _tr_flush_block(s, buf, stored_len, last) {
        var opt_lenb, static_lenb;
        var max_blindex = 0;
        if (s.level > 0) {
          if (s.strm.data_type === Z_UNKNOWN) {
            s.strm.data_type = detect_data_type(s);
          }
          build_tree(s, s.l_desc);
          build_tree(s, s.d_desc);
          max_blindex = build_bl_tree(s);
          opt_lenb = s.opt_len + 3 + 7 >>> 3;
          static_lenb = s.static_len + 3 + 7 >>> 3;
          if (static_lenb <= opt_lenb) {
            opt_lenb = static_lenb;
          }
        } else {
          opt_lenb = static_lenb = stored_len + 5;
        }
        if (stored_len + 4 <= opt_lenb && buf !== -1) {
          _tr_stored_block(s, buf, stored_len, last);
        } else if (s.strategy === Z_FIXED || static_lenb === opt_lenb) {
          send_bits(s, (STATIC_TREES << 1) + (last ? 1 : 0), 3);
          compress_block(s, static_ltree, static_dtree);
        } else {
          send_bits(s, (DYN_TREES << 1) + (last ? 1 : 0), 3);
          send_all_trees(s, s.l_desc.max_code + 1, s.d_desc.max_code + 1, max_blindex + 1);
          compress_block(s, s.dyn_ltree, s.dyn_dtree);
        }
        init_block(s);
        if (last) {
          bi_windup(s);
        }
      }
      function _tr_tally(s, dist, lc) {
        s.pending_buf[s.d_buf + s.last_lit * 2] = dist >>> 8 & 255;
        s.pending_buf[s.d_buf + s.last_lit * 2 + 1] = dist & 255;
        s.pending_buf[s.l_buf + s.last_lit] = lc & 255;
        s.last_lit++;
        if (dist === 0) {
          s.dyn_ltree[lc * 2]++;
        } else {
          s.matches++;
          dist--;
          s.dyn_ltree[(_length_code[lc] + LITERALS + 1) * 2]++;
          s.dyn_dtree[d_code(dist) * 2]++;
        }
        return s.last_lit === s.lit_bufsize - 1;
      }
      exports._tr_init = _tr_init;
      exports._tr_stored_block = _tr_stored_block;
      exports._tr_flush_block = _tr_flush_block;
      exports._tr_tally = _tr_tally;
      exports._tr_align = _tr_align;
    }
  });

  // node_modules/pako/lib/zlib/adler32.js
  var require_adler32 = __commonJS({
    "node_modules/pako/lib/zlib/adler32.js"(exports, module) {
      "use strict";
      function adler32(adler, buf, len, pos) {
        var s1 = adler & 65535 | 0, s2 = adler >>> 16 & 65535 | 0, n = 0;
        while (len !== 0) {
          n = len > 2e3 ? 2e3 : len;
          len -= n;
          do {
            s1 = s1 + buf[pos++] | 0;
            s2 = s2 + s1 | 0;
          } while (--n);
          s1 %= 65521;
          s2 %= 65521;
        }
        return s1 | s2 << 16 | 0;
      }
      module.exports = adler32;
    }
  });

  // node_modules/pako/lib/zlib/crc32.js
  var require_crc32 = __commonJS({
    "node_modules/pako/lib/zlib/crc32.js"(exports, module) {
      "use strict";
      function makeTable() {
        var c, table = [];
        for (var n = 0; n < 256; n++) {
          c = n;
          for (var k = 0; k < 8; k++) {
            c = c & 1 ? 3988292384 ^ c >>> 1 : c >>> 1;
          }
          table[n] = c;
        }
        return table;
      }
      var crcTable = makeTable();
      function crc322(crc, buf, len, pos) {
        var t = crcTable, end = pos + len;
        crc ^= -1;
        for (var i = pos; i < end; i++) {
          crc = crc >>> 8 ^ t[(crc ^ buf[i]) & 255];
        }
        return crc ^ -1;
      }
      module.exports = crc322;
    }
  });

  // node_modules/pako/lib/zlib/messages.js
  var require_messages = __commonJS({
    "node_modules/pako/lib/zlib/messages.js"(exports, module) {
      "use strict";
      module.exports = {
        2: "need dictionary",
        /* Z_NEED_DICT       2  */
        1: "stream end",
        /* Z_STREAM_END      1  */
        0: "",
        /* Z_OK              0  */
        "-1": "file error",
        /* Z_ERRNO         (-1) */
        "-2": "stream error",
        /* Z_STREAM_ERROR  (-2) */
        "-3": "data error",
        /* Z_DATA_ERROR    (-3) */
        "-4": "insufficient memory",
        /* Z_MEM_ERROR     (-4) */
        "-5": "buffer error",
        /* Z_BUF_ERROR     (-5) */
        "-6": "incompatible version"
        /* Z_VERSION_ERROR (-6) */
      };
    }
  });

  // node_modules/pako/lib/zlib/deflate.js
  var require_deflate = __commonJS({
    "node_modules/pako/lib/zlib/deflate.js"(exports) {
      "use strict";
      var utils = require_common();
      var trees = require_trees();
      var adler32 = require_adler32();
      var crc322 = require_crc32();
      var msg = require_messages();
      var Z_NO_FLUSH = 0;
      var Z_PARTIAL_FLUSH = 1;
      var Z_FULL_FLUSH = 3;
      var Z_FINISH = 4;
      var Z_BLOCK = 5;
      var Z_OK = 0;
      var Z_STREAM_END = 1;
      var Z_STREAM_ERROR = -2;
      var Z_DATA_ERROR = -3;
      var Z_BUF_ERROR = -5;
      var Z_DEFAULT_COMPRESSION = -1;
      var Z_FILTERED = 1;
      var Z_HUFFMAN_ONLY = 2;
      var Z_RLE = 3;
      var Z_FIXED = 4;
      var Z_DEFAULT_STRATEGY = 0;
      var Z_UNKNOWN = 2;
      var Z_DEFLATED = 8;
      var MAX_MEM_LEVEL = 9;
      var MAX_WBITS = 15;
      var DEF_MEM_LEVEL = 8;
      var LENGTH_CODES = 29;
      var LITERALS = 256;
      var L_CODES = LITERALS + 1 + LENGTH_CODES;
      var D_CODES = 30;
      var BL_CODES = 19;
      var HEAP_SIZE = 2 * L_CODES + 1;
      var MAX_BITS = 15;
      var MIN_MATCH = 3;
      var MAX_MATCH = 258;
      var MIN_LOOKAHEAD = MAX_MATCH + MIN_MATCH + 1;
      var PRESET_DICT = 32;
      var INIT_STATE = 42;
      var EXTRA_STATE = 69;
      var NAME_STATE = 73;
      var COMMENT_STATE = 91;
      var HCRC_STATE = 103;
      var BUSY_STATE = 113;
      var FINISH_STATE = 666;
      var BS_NEED_MORE = 1;
      var BS_BLOCK_DONE = 2;
      var BS_FINISH_STARTED = 3;
      var BS_FINISH_DONE = 4;
      var OS_CODE = 3;
      function err(strm, errorCode) {
        strm.msg = msg[errorCode];
        return errorCode;
      }
      function rank(f) {
        return (f << 1) - (f > 4 ? 9 : 0);
      }
      function zero(buf) {
        var len = buf.length;
        while (--len >= 0) {
          buf[len] = 0;
        }
      }
      function flush_pending(strm) {
        var s = strm.state;
        var len = s.pending;
        if (len > strm.avail_out) {
          len = strm.avail_out;
        }
        if (len === 0) {
          return;
        }
        utils.arraySet(strm.output, s.pending_buf, s.pending_out, len, strm.next_out);
        strm.next_out += len;
        s.pending_out += len;
        strm.total_out += len;
        strm.avail_out -= len;
        s.pending -= len;
        if (s.pending === 0) {
          s.pending_out = 0;
        }
      }
      function flush_block_only(s, last) {
        trees._tr_flush_block(s, s.block_start >= 0 ? s.block_start : -1, s.strstart - s.block_start, last);
        s.block_start = s.strstart;
        flush_pending(s.strm);
      }
      function put_byte(s, b) {
        s.pending_buf[s.pending++] = b;
      }
      function putShortMSB(s, b) {
        s.pending_buf[s.pending++] = b >>> 8 & 255;
        s.pending_buf[s.pending++] = b & 255;
      }
      function read_buf(strm, buf, start, size) {
        var len = strm.avail_in;
        if (len > size) {
          len = size;
        }
        if (len === 0) {
          return 0;
        }
        strm.avail_in -= len;
        utils.arraySet(buf, strm.input, strm.next_in, len, start);
        if (strm.state.wrap === 1) {
          strm.adler = adler32(strm.adler, buf, len, start);
        } else if (strm.state.wrap === 2) {
          strm.adler = crc322(strm.adler, buf, len, start);
        }
        strm.next_in += len;
        strm.total_in += len;
        return len;
      }
      function longest_match(s, cur_match) {
        var chain_length = s.max_chain_length;
        var scan = s.strstart;
        var match;
        var len;
        var best_len = s.prev_length;
        var nice_match = s.nice_match;
        var limit = s.strstart > s.w_size - MIN_LOOKAHEAD ? s.strstart - (s.w_size - MIN_LOOKAHEAD) : 0;
        var _win = s.window;
        var wmask = s.w_mask;
        var prev = s.prev;
        var strend = s.strstart + MAX_MATCH;
        var scan_end1 = _win[scan + best_len - 1];
        var scan_end = _win[scan + best_len];
        if (s.prev_length >= s.good_match) {
          chain_length >>= 2;
        }
        if (nice_match > s.lookahead) {
          nice_match = s.lookahead;
        }
        do {
          match = cur_match;
          if (_win[match + best_len] !== scan_end || _win[match + best_len - 1] !== scan_end1 || _win[match] !== _win[scan] || _win[++match] !== _win[scan + 1]) {
            continue;
          }
          scan += 2;
          match++;
          do {
          } while (_win[++scan] === _win[++match] && _win[++scan] === _win[++match] && _win[++scan] === _win[++match] && _win[++scan] === _win[++match] && _win[++scan] === _win[++match] && _win[++scan] === _win[++match] && _win[++scan] === _win[++match] && _win[++scan] === _win[++match] && scan < strend);
          len = MAX_MATCH - (strend - scan);
          scan = strend - MAX_MATCH;
          if (len > best_len) {
            s.match_start = cur_match;
            best_len = len;
            if (len >= nice_match) {
              break;
            }
            scan_end1 = _win[scan + best_len - 1];
            scan_end = _win[scan + best_len];
          }
        } while ((cur_match = prev[cur_match & wmask]) > limit && --chain_length !== 0);
        if (best_len <= s.lookahead) {
          return best_len;
        }
        return s.lookahead;
      }
      function fill_window(s) {
        var _w_size = s.w_size;
        var p, n, m, more, str;
        do {
          more = s.window_size - s.lookahead - s.strstart;
          if (s.strstart >= _w_size + (_w_size - MIN_LOOKAHEAD)) {
            utils.arraySet(s.window, s.window, _w_size, _w_size, 0);
            s.match_start -= _w_size;
            s.strstart -= _w_size;
            s.block_start -= _w_size;
            n = s.hash_size;
            p = n;
            do {
              m = s.head[--p];
              s.head[p] = m >= _w_size ? m - _w_size : 0;
            } while (--n);
            n = _w_size;
            p = n;
            do {
              m = s.prev[--p];
              s.prev[p] = m >= _w_size ? m - _w_size : 0;
            } while (--n);
            more += _w_size;
          }
          if (s.strm.avail_in === 0) {
            break;
          }
          n = read_buf(s.strm, s.window, s.strstart + s.lookahead, more);
          s.lookahead += n;
          if (s.lookahead + s.insert >= MIN_MATCH) {
            str = s.strstart - s.insert;
            s.ins_h = s.window[str];
            s.ins_h = (s.ins_h << s.hash_shift ^ s.window[str + 1]) & s.hash_mask;
            while (s.insert) {
              s.ins_h = (s.ins_h << s.hash_shift ^ s.window[str + MIN_MATCH - 1]) & s.hash_mask;
              s.prev[str & s.w_mask] = s.head[s.ins_h];
              s.head[s.ins_h] = str;
              str++;
              s.insert--;
              if (s.lookahead + s.insert < MIN_MATCH) {
                break;
              }
            }
          }
        } while (s.lookahead < MIN_LOOKAHEAD && s.strm.avail_in !== 0);
      }
      function deflate_stored(s, flush) {
        var max_block_size = 65535;
        if (max_block_size > s.pending_buf_size - 5) {
          max_block_size = s.pending_buf_size - 5;
        }
        for (; ; ) {
          if (s.lookahead <= 1) {
            fill_window(s);
            if (s.lookahead === 0 && flush === Z_NO_FLUSH) {
              return BS_NEED_MORE;
            }
            if (s.lookahead === 0) {
              break;
            }
          }
          s.strstart += s.lookahead;
          s.lookahead = 0;
          var max_start = s.block_start + max_block_size;
          if (s.strstart === 0 || s.strstart >= max_start) {
            s.lookahead = s.strstart - max_start;
            s.strstart = max_start;
            flush_block_only(s, false);
            if (s.strm.avail_out === 0) {
              return BS_NEED_MORE;
            }
          }
          if (s.strstart - s.block_start >= s.w_size - MIN_LOOKAHEAD) {
            flush_block_only(s, false);
            if (s.strm.avail_out === 0) {
              return BS_NEED_MORE;
            }
          }
        }
        s.insert = 0;
        if (flush === Z_FINISH) {
          flush_block_only(s, true);
          if (s.strm.avail_out === 0) {
            return BS_FINISH_STARTED;
          }
          return BS_FINISH_DONE;
        }
        if (s.strstart > s.block_start) {
          flush_block_only(s, false);
          if (s.strm.avail_out === 0) {
            return BS_NEED_MORE;
          }
        }
        return BS_NEED_MORE;
      }
      function deflate_fast(s, flush) {
        var hash_head;
        var bflush;
        for (; ; ) {
          if (s.lookahead < MIN_LOOKAHEAD) {
            fill_window(s);
            if (s.lookahead < MIN_LOOKAHEAD && flush === Z_NO_FLUSH) {
              return BS_NEED_MORE;
            }
            if (s.lookahead === 0) {
              break;
            }
          }
          hash_head = 0;
          if (s.lookahead >= MIN_MATCH) {
            s.ins_h = (s.ins_h << s.hash_shift ^ s.window[s.strstart + MIN_MATCH - 1]) & s.hash_mask;
            hash_head = s.prev[s.strstart & s.w_mask] = s.head[s.ins_h];
            s.head[s.ins_h] = s.strstart;
          }
          if (hash_head !== 0 && s.strstart - hash_head <= s.w_size - MIN_LOOKAHEAD) {
            s.match_length = longest_match(s, hash_head);
          }
          if (s.match_length >= MIN_MATCH) {
            bflush = trees._tr_tally(s, s.strstart - s.match_start, s.match_length - MIN_MATCH);
            s.lookahead -= s.match_length;
            if (s.match_length <= s.max_lazy_match && s.lookahead >= MIN_MATCH) {
              s.match_length--;
              do {
                s.strstart++;
                s.ins_h = (s.ins_h << s.hash_shift ^ s.window[s.strstart + MIN_MATCH - 1]) & s.hash_mask;
                hash_head = s.prev[s.strstart & s.w_mask] = s.head[s.ins_h];
                s.head[s.ins_h] = s.strstart;
              } while (--s.match_length !== 0);
              s.strstart++;
            } else {
              s.strstart += s.match_length;
              s.match_length = 0;
              s.ins_h = s.window[s.strstart];
              s.ins_h = (s.ins_h << s.hash_shift ^ s.window[s.strstart + 1]) & s.hash_mask;
            }
          } else {
            bflush = trees._tr_tally(s, 0, s.window[s.strstart]);
            s.lookahead--;
            s.strstart++;
          }
          if (bflush) {
            flush_block_only(s, false);
            if (s.strm.avail_out === 0) {
              return BS_NEED_MORE;
            }
          }
        }
        s.insert = s.strstart < MIN_MATCH - 1 ? s.strstart : MIN_MATCH - 1;
        if (flush === Z_FINISH) {
          flush_block_only(s, true);
          if (s.strm.avail_out === 0) {
            return BS_FINISH_STARTED;
          }
          return BS_FINISH_DONE;
        }
        if (s.last_lit) {
          flush_block_only(s, false);
          if (s.strm.avail_out === 0) {
            return BS_NEED_MORE;
          }
        }
        return BS_BLOCK_DONE;
      }
      function deflate_slow(s, flush) {
        var hash_head;
        var bflush;
        var max_insert;
        for (; ; ) {
          if (s.lookahead < MIN_LOOKAHEAD) {
            fill_window(s);
            if (s.lookahead < MIN_LOOKAHEAD && flush === Z_NO_FLUSH) {
              return BS_NEED_MORE;
            }
            if (s.lookahead === 0) {
              break;
            }
          }
          hash_head = 0;
          if (s.lookahead >= MIN_MATCH) {
            s.ins_h = (s.ins_h << s.hash_shift ^ s.window[s.strstart + MIN_MATCH - 1]) & s.hash_mask;
            hash_head = s.prev[s.strstart & s.w_mask] = s.head[s.ins_h];
            s.head[s.ins_h] = s.strstart;
          }
          s.prev_length = s.match_length;
          s.prev_match = s.match_start;
          s.match_length = MIN_MATCH - 1;
          if (hash_head !== 0 && s.prev_length < s.max_lazy_match && s.strstart - hash_head <= s.w_size - MIN_LOOKAHEAD) {
            s.match_length = longest_match(s, hash_head);
            if (s.match_length <= 5 && (s.strategy === Z_FILTERED || s.match_length === MIN_MATCH && s.strstart - s.match_start > 4096)) {
              s.match_length = MIN_MATCH - 1;
            }
          }
          if (s.prev_length >= MIN_MATCH && s.match_length <= s.prev_length) {
            max_insert = s.strstart + s.lookahead - MIN_MATCH;
            bflush = trees._tr_tally(s, s.strstart - 1 - s.prev_match, s.prev_length - MIN_MATCH);
            s.lookahead -= s.prev_length - 1;
            s.prev_length -= 2;
            do {
              if (++s.strstart <= max_insert) {
                s.ins_h = (s.ins_h << s.hash_shift ^ s.window[s.strstart + MIN_MATCH - 1]) & s.hash_mask;
                hash_head = s.prev[s.strstart & s.w_mask] = s.head[s.ins_h];
                s.head[s.ins_h] = s.strstart;
              }
            } while (--s.prev_length !== 0);
            s.match_available = 0;
            s.match_length = MIN_MATCH - 1;
            s.strstart++;
            if (bflush) {
              flush_block_only(s, false);
              if (s.strm.avail_out === 0) {
                return BS_NEED_MORE;
              }
            }
          } else if (s.match_available) {
            bflush = trees._tr_tally(s, 0, s.window[s.strstart - 1]);
            if (bflush) {
              flush_block_only(s, false);
            }
            s.strstart++;
            s.lookahead--;
            if (s.strm.avail_out === 0) {
              return BS_NEED_MORE;
            }
          } else {
            s.match_available = 1;
            s.strstart++;
            s.lookahead--;
          }
        }
        if (s.match_available) {
          bflush = trees._tr_tally(s, 0, s.window[s.strstart - 1]);
          s.match_available = 0;
        }
        s.insert = s.strstart < MIN_MATCH - 1 ? s.strstart : MIN_MATCH - 1;
        if (flush === Z_FINISH) {
          flush_block_only(s, true);
          if (s.strm.avail_out === 0) {
            return BS_FINISH_STARTED;
          }
          return BS_FINISH_DONE;
        }
        if (s.last_lit) {
          flush_block_only(s, false);
          if (s.strm.avail_out === 0) {
            return BS_NEED_MORE;
          }
        }
        return BS_BLOCK_DONE;
      }
      function deflate_rle(s, flush) {
        var bflush;
        var prev;
        var scan, strend;
        var _win = s.window;
        for (; ; ) {
          if (s.lookahead <= MAX_MATCH) {
            fill_window(s);
            if (s.lookahead <= MAX_MATCH && flush === Z_NO_FLUSH) {
              return BS_NEED_MORE;
            }
            if (s.lookahead === 0) {
              break;
            }
          }
          s.match_length = 0;
          if (s.lookahead >= MIN_MATCH && s.strstart > 0) {
            scan = s.strstart - 1;
            prev = _win[scan];
            if (prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan]) {
              strend = s.strstart + MAX_MATCH;
              do {
              } while (prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan] && scan < strend);
              s.match_length = MAX_MATCH - (strend - scan);
              if (s.match_length > s.lookahead) {
                s.match_length = s.lookahead;
              }
            }
          }
          if (s.match_length >= MIN_MATCH) {
            bflush = trees._tr_tally(s, 1, s.match_length - MIN_MATCH);
            s.lookahead -= s.match_length;
            s.strstart += s.match_length;
            s.match_length = 0;
          } else {
            bflush = trees._tr_tally(s, 0, s.window[s.strstart]);
            s.lookahead--;
            s.strstart++;
          }
          if (bflush) {
            flush_block_only(s, false);
            if (s.strm.avail_out === 0) {
              return BS_NEED_MORE;
            }
          }
        }
        s.insert = 0;
        if (flush === Z_FINISH) {
          flush_block_only(s, true);
          if (s.strm.avail_out === 0) {
            return BS_FINISH_STARTED;
          }
          return BS_FINISH_DONE;
        }
        if (s.last_lit) {
          flush_block_only(s, false);
          if (s.strm.avail_out === 0) {
            return BS_NEED_MORE;
          }
        }
        return BS_BLOCK_DONE;
      }
      function deflate_huff(s, flush) {
        var bflush;
        for (; ; ) {
          if (s.lookahead === 0) {
            fill_window(s);
            if (s.lookahead === 0) {
              if (flush === Z_NO_FLUSH) {
                return BS_NEED_MORE;
              }
              break;
            }
          }
          s.match_length = 0;
          bflush = trees._tr_tally(s, 0, s.window[s.strstart]);
          s.lookahead--;
          s.strstart++;
          if (bflush) {
            flush_block_only(s, false);
            if (s.strm.avail_out === 0) {
              return BS_NEED_MORE;
            }
          }
        }
        s.insert = 0;
        if (flush === Z_FINISH) {
          flush_block_only(s, true);
          if (s.strm.avail_out === 0) {
            return BS_FINISH_STARTED;
          }
          return BS_FINISH_DONE;
        }
        if (s.last_lit) {
          flush_block_only(s, false);
          if (s.strm.avail_out === 0) {
            return BS_NEED_MORE;
          }
        }
        return BS_BLOCK_DONE;
      }
      function Config(good_length, max_lazy, nice_length, max_chain, func) {
        this.good_length = good_length;
        this.max_lazy = max_lazy;
        this.nice_length = nice_length;
        this.max_chain = max_chain;
        this.func = func;
      }
      var configuration_table;
      configuration_table = [
        /*      good lazy nice chain */
        new Config(0, 0, 0, 0, deflate_stored),
        /* 0 store only */
        new Config(4, 4, 8, 4, deflate_fast),
        /* 1 max speed, no lazy matches */
        new Config(4, 5, 16, 8, deflate_fast),
        /* 2 */
        new Config(4, 6, 32, 32, deflate_fast),
        /* 3 */
        new Config(4, 4, 16, 16, deflate_slow),
        /* 4 lazy matches */
        new Config(8, 16, 32, 32, deflate_slow),
        /* 5 */
        new Config(8, 16, 128, 128, deflate_slow),
        /* 6 */
        new Config(8, 32, 128, 256, deflate_slow),
        /* 7 */
        new Config(32, 128, 258, 1024, deflate_slow),
        /* 8 */
        new Config(32, 258, 258, 4096, deflate_slow)
        /* 9 max compression */
      ];
      function lm_init(s) {
        s.window_size = 2 * s.w_size;
        zero(s.head);
        s.max_lazy_match = configuration_table[s.level].max_lazy;
        s.good_match = configuration_table[s.level].good_length;
        s.nice_match = configuration_table[s.level].nice_length;
        s.max_chain_length = configuration_table[s.level].max_chain;
        s.strstart = 0;
        s.block_start = 0;
        s.lookahead = 0;
        s.insert = 0;
        s.match_length = s.prev_length = MIN_MATCH - 1;
        s.match_available = 0;
        s.ins_h = 0;
      }
      function DeflateState() {
        this.strm = null;
        this.status = 0;
        this.pending_buf = null;
        this.pending_buf_size = 0;
        this.pending_out = 0;
        this.pending = 0;
        this.wrap = 0;
        this.gzhead = null;
        this.gzindex = 0;
        this.method = Z_DEFLATED;
        this.last_flush = -1;
        this.w_size = 0;
        this.w_bits = 0;
        this.w_mask = 0;
        this.window = null;
        this.window_size = 0;
        this.prev = null;
        this.head = null;
        this.ins_h = 0;
        this.hash_size = 0;
        this.hash_bits = 0;
        this.hash_mask = 0;
        this.hash_shift = 0;
        this.block_start = 0;
        this.match_length = 0;
        this.prev_match = 0;
        this.match_available = 0;
        this.strstart = 0;
        this.match_start = 0;
        this.lookahead = 0;
        this.prev_length = 0;
        this.max_chain_length = 0;
        this.max_lazy_match = 0;
        this.level = 0;
        this.strategy = 0;
        this.good_match = 0;
        this.nice_match = 0;
        this.dyn_ltree = new utils.Buf16(HEAP_SIZE * 2);
        this.dyn_dtree = new utils.Buf16((2 * D_CODES + 1) * 2);
        this.bl_tree = new utils.Buf16((2 * BL_CODES + 1) * 2);
        zero(this.dyn_ltree);
        zero(this.dyn_dtree);
        zero(this.bl_tree);
        this.l_desc = null;
        this.d_desc = null;
        this.bl_desc = null;
        this.bl_count = new utils.Buf16(MAX_BITS + 1);
        this.heap = new utils.Buf16(2 * L_CODES + 1);
        zero(this.heap);
        this.heap_len = 0;
        this.heap_max = 0;
        this.depth = new utils.Buf16(2 * L_CODES + 1);
        zero(this.depth);
        this.l_buf = 0;
        this.lit_bufsize = 0;
        this.last_lit = 0;
        this.d_buf = 0;
        this.opt_len = 0;
        this.static_len = 0;
        this.matches = 0;
        this.insert = 0;
        this.bi_buf = 0;
        this.bi_valid = 0;
      }
      function deflateResetKeep(strm) {
        var s;
        if (!strm || !strm.state) {
          return err(strm, Z_STREAM_ERROR);
        }
        strm.total_in = strm.total_out = 0;
        strm.data_type = Z_UNKNOWN;
        s = strm.state;
        s.pending = 0;
        s.pending_out = 0;
        if (s.wrap < 0) {
          s.wrap = -s.wrap;
        }
        s.status = s.wrap ? INIT_STATE : BUSY_STATE;
        strm.adler = s.wrap === 2 ? 0 : 1;
        s.last_flush = Z_NO_FLUSH;
        trees._tr_init(s);
        return Z_OK;
      }
      function deflateReset(strm) {
        var ret = deflateResetKeep(strm);
        if (ret === Z_OK) {
          lm_init(strm.state);
        }
        return ret;
      }
      function deflateSetHeader(strm, head) {
        if (!strm || !strm.state) {
          return Z_STREAM_ERROR;
        }
        if (strm.state.wrap !== 2) {
          return Z_STREAM_ERROR;
        }
        strm.state.gzhead = head;
        return Z_OK;
      }
      function deflateInit2(strm, level, method, windowBits, memLevel, strategy) {
        if (!strm) {
          return Z_STREAM_ERROR;
        }
        var wrap = 1;
        if (level === Z_DEFAULT_COMPRESSION) {
          level = 6;
        }
        if (windowBits < 0) {
          wrap = 0;
          windowBits = -windowBits;
        } else if (windowBits > 15) {
          wrap = 2;
          windowBits -= 16;
        }
        if (memLevel < 1 || memLevel > MAX_MEM_LEVEL || method !== Z_DEFLATED || windowBits < 8 || windowBits > 15 || level < 0 || level > 9 || strategy < 0 || strategy > Z_FIXED) {
          return err(strm, Z_STREAM_ERROR);
        }
        if (windowBits === 8) {
          windowBits = 9;
        }
        var s = new DeflateState();
        strm.state = s;
        s.strm = strm;
        s.wrap = wrap;
        s.gzhead = null;
        s.w_bits = windowBits;
        s.w_size = 1 << s.w_bits;
        s.w_mask = s.w_size - 1;
        s.hash_bits = memLevel + 7;
        s.hash_size = 1 << s.hash_bits;
        s.hash_mask = s.hash_size - 1;
        s.hash_shift = ~~((s.hash_bits + MIN_MATCH - 1) / MIN_MATCH);
        s.window = new utils.Buf8(s.w_size * 2);
        s.head = new utils.Buf16(s.hash_size);
        s.prev = new utils.Buf16(s.w_size);
        s.lit_bufsize = 1 << memLevel + 6;
        s.pending_buf_size = s.lit_bufsize * 4;
        s.pending_buf = new utils.Buf8(s.pending_buf_size);
        s.d_buf = 1 * s.lit_bufsize;
        s.l_buf = (1 + 2) * s.lit_bufsize;
        s.level = level;
        s.strategy = strategy;
        s.method = method;
        return deflateReset(strm);
      }
      function deflateInit(strm, level) {
        return deflateInit2(strm, level, Z_DEFLATED, MAX_WBITS, DEF_MEM_LEVEL, Z_DEFAULT_STRATEGY);
      }
      function deflate(strm, flush) {
        var old_flush, s;
        var beg, val;
        if (!strm || !strm.state || flush > Z_BLOCK || flush < 0) {
          return strm ? err(strm, Z_STREAM_ERROR) : Z_STREAM_ERROR;
        }
        s = strm.state;
        if (!strm.output || !strm.input && strm.avail_in !== 0 || s.status === FINISH_STATE && flush !== Z_FINISH) {
          return err(strm, strm.avail_out === 0 ? Z_BUF_ERROR : Z_STREAM_ERROR);
        }
        s.strm = strm;
        old_flush = s.last_flush;
        s.last_flush = flush;
        if (s.status === INIT_STATE) {
          if (s.wrap === 2) {
            strm.adler = 0;
            put_byte(s, 31);
            put_byte(s, 139);
            put_byte(s, 8);
            if (!s.gzhead) {
              put_byte(s, 0);
              put_byte(s, 0);
              put_byte(s, 0);
              put_byte(s, 0);
              put_byte(s, 0);
              put_byte(s, s.level === 9 ? 2 : s.strategy >= Z_HUFFMAN_ONLY || s.level < 2 ? 4 : 0);
              put_byte(s, OS_CODE);
              s.status = BUSY_STATE;
            } else {
              put_byte(
                s,
                (s.gzhead.text ? 1 : 0) + (s.gzhead.hcrc ? 2 : 0) + (!s.gzhead.extra ? 0 : 4) + (!s.gzhead.name ? 0 : 8) + (!s.gzhead.comment ? 0 : 16)
              );
              put_byte(s, s.gzhead.time & 255);
              put_byte(s, s.gzhead.time >> 8 & 255);
              put_byte(s, s.gzhead.time >> 16 & 255);
              put_byte(s, s.gzhead.time >> 24 & 255);
              put_byte(s, s.level === 9 ? 2 : s.strategy >= Z_HUFFMAN_ONLY || s.level < 2 ? 4 : 0);
              put_byte(s, s.gzhead.os & 255);
              if (s.gzhead.extra && s.gzhead.extra.length) {
                put_byte(s, s.gzhead.extra.length & 255);
                put_byte(s, s.gzhead.extra.length >> 8 & 255);
              }
              if (s.gzhead.hcrc) {
                strm.adler = crc322(strm.adler, s.pending_buf, s.pending, 0);
              }
              s.gzindex = 0;
              s.status = EXTRA_STATE;
            }
          } else {
            var header = Z_DEFLATED + (s.w_bits - 8 << 4) << 8;
            var level_flags = -1;
            if (s.strategy >= Z_HUFFMAN_ONLY || s.level < 2) {
              level_flags = 0;
            } else if (s.level < 6) {
              level_flags = 1;
            } else if (s.level === 6) {
              level_flags = 2;
            } else {
              level_flags = 3;
            }
            header |= level_flags << 6;
            if (s.strstart !== 0) {
              header |= PRESET_DICT;
            }
            header += 31 - header % 31;
            s.status = BUSY_STATE;
            putShortMSB(s, header);
            if (s.strstart !== 0) {
              putShortMSB(s, strm.adler >>> 16);
              putShortMSB(s, strm.adler & 65535);
            }
            strm.adler = 1;
          }
        }
        if (s.status === EXTRA_STATE) {
          if (s.gzhead.extra) {
            beg = s.pending;
            while (s.gzindex < (s.gzhead.extra.length & 65535)) {
              if (s.pending === s.pending_buf_size) {
                if (s.gzhead.hcrc && s.pending > beg) {
                  strm.adler = crc322(strm.adler, s.pending_buf, s.pending - beg, beg);
                }
                flush_pending(strm);
                beg = s.pending;
                if (s.pending === s.pending_buf_size) {
                  break;
                }
              }
              put_byte(s, s.gzhead.extra[s.gzindex] & 255);
              s.gzindex++;
            }
            if (s.gzhead.hcrc && s.pending > beg) {
              strm.adler = crc322(strm.adler, s.pending_buf, s.pending - beg, beg);
            }
            if (s.gzindex === s.gzhead.extra.length) {
              s.gzindex = 0;
              s.status = NAME_STATE;
            }
          } else {
            s.status = NAME_STATE;
          }
        }
        if (s.status === NAME_STATE) {
          if (s.gzhead.name) {
            beg = s.pending;
            do {
              if (s.pending === s.pending_buf_size) {
                if (s.gzhead.hcrc && s.pending > beg) {
                  strm.adler = crc322(strm.adler, s.pending_buf, s.pending - beg, beg);
                }
                flush_pending(strm);
                beg = s.pending;
                if (s.pending === s.pending_buf_size) {
                  val = 1;
                  break;
                }
              }
              if (s.gzindex < s.gzhead.name.length) {
                val = s.gzhead.name.charCodeAt(s.gzindex++) & 255;
              } else {
                val = 0;
              }
              put_byte(s, val);
            } while (val !== 0);
            if (s.gzhead.hcrc && s.pending > beg) {
              strm.adler = crc322(strm.adler, s.pending_buf, s.pending - beg, beg);
            }
            if (val === 0) {
              s.gzindex = 0;
              s.status = COMMENT_STATE;
            }
          } else {
            s.status = COMMENT_STATE;
          }
        }
        if (s.status === COMMENT_STATE) {
          if (s.gzhead.comment) {
            beg = s.pending;
            do {
              if (s.pending === s.pending_buf_size) {
                if (s.gzhead.hcrc && s.pending > beg) {
                  strm.adler = crc322(strm.adler, s.pending_buf, s.pending - beg, beg);
                }
                flush_pending(strm);
                beg = s.pending;
                if (s.pending === s.pending_buf_size) {
                  val = 1;
                  break;
                }
              }
              if (s.gzindex < s.gzhead.comment.length) {
                val = s.gzhead.comment.charCodeAt(s.gzindex++) & 255;
              } else {
                val = 0;
              }
              put_byte(s, val);
            } while (val !== 0);
            if (s.gzhead.hcrc && s.pending > beg) {
              strm.adler = crc322(strm.adler, s.pending_buf, s.pending - beg, beg);
            }
            if (val === 0) {
              s.status = HCRC_STATE;
            }
          } else {
            s.status = HCRC_STATE;
          }
        }
        if (s.status === HCRC_STATE) {
          if (s.gzhead.hcrc) {
            if (s.pending + 2 > s.pending_buf_size) {
              flush_pending(strm);
            }
            if (s.pending + 2 <= s.pending_buf_size) {
              put_byte(s, strm.adler & 255);
              put_byte(s, strm.adler >> 8 & 255);
              strm.adler = 0;
              s.status = BUSY_STATE;
            }
          } else {
            s.status = BUSY_STATE;
          }
        }
        if (s.pending !== 0) {
          flush_pending(strm);
          if (strm.avail_out === 0) {
            s.last_flush = -1;
            return Z_OK;
          }
        } else if (strm.avail_in === 0 && rank(flush) <= rank(old_flush) && flush !== Z_FINISH) {
          return err(strm, Z_BUF_ERROR);
        }
        if (s.status === FINISH_STATE && strm.avail_in !== 0) {
          return err(strm, Z_BUF_ERROR);
        }
        if (strm.avail_in !== 0 || s.lookahead !== 0 || flush !== Z_NO_FLUSH && s.status !== FINISH_STATE) {
          var bstate = s.strategy === Z_HUFFMAN_ONLY ? deflate_huff(s, flush) : s.strategy === Z_RLE ? deflate_rle(s, flush) : configuration_table[s.level].func(s, flush);
          if (bstate === BS_FINISH_STARTED || bstate === BS_FINISH_DONE) {
            s.status = FINISH_STATE;
          }
          if (bstate === BS_NEED_MORE || bstate === BS_FINISH_STARTED) {
            if (strm.avail_out === 0) {
              s.last_flush = -1;
            }
            return Z_OK;
          }
          if (bstate === BS_BLOCK_DONE) {
            if (flush === Z_PARTIAL_FLUSH) {
              trees._tr_align(s);
            } else if (flush !== Z_BLOCK) {
              trees._tr_stored_block(s, 0, 0, false);
              if (flush === Z_FULL_FLUSH) {
                zero(s.head);
                if (s.lookahead === 0) {
                  s.strstart = 0;
                  s.block_start = 0;
                  s.insert = 0;
                }
              }
            }
            flush_pending(strm);
            if (strm.avail_out === 0) {
              s.last_flush = -1;
              return Z_OK;
            }
          }
        }
        if (flush !== Z_FINISH) {
          return Z_OK;
        }
        if (s.wrap <= 0) {
          return Z_STREAM_END;
        }
        if (s.wrap === 2) {
          put_byte(s, strm.adler & 255);
          put_byte(s, strm.adler >> 8 & 255);
          put_byte(s, strm.adler >> 16 & 255);
          put_byte(s, strm.adler >> 24 & 255);
          put_byte(s, strm.total_in & 255);
          put_byte(s, strm.total_in >> 8 & 255);
          put_byte(s, strm.total_in >> 16 & 255);
          put_byte(s, strm.total_in >> 24 & 255);
        } else {
          putShortMSB(s, strm.adler >>> 16);
          putShortMSB(s, strm.adler & 65535);
        }
        flush_pending(strm);
        if (s.wrap > 0) {
          s.wrap = -s.wrap;
        }
        return s.pending !== 0 ? Z_OK : Z_STREAM_END;
      }
      function deflateEnd(strm) {
        var status2;
        if (!strm || !strm.state) {
          return Z_STREAM_ERROR;
        }
        status2 = strm.state.status;
        if (status2 !== INIT_STATE && status2 !== EXTRA_STATE && status2 !== NAME_STATE && status2 !== COMMENT_STATE && status2 !== HCRC_STATE && status2 !== BUSY_STATE && status2 !== FINISH_STATE) {
          return err(strm, Z_STREAM_ERROR);
        }
        strm.state = null;
        return status2 === BUSY_STATE ? err(strm, Z_DATA_ERROR) : Z_OK;
      }
      function deflateSetDictionary(strm, dictionary) {
        var dictLength = dictionary.length;
        var s;
        var str, n;
        var wrap;
        var avail;
        var next;
        var input;
        var tmpDict;
        if (!strm || !strm.state) {
          return Z_STREAM_ERROR;
        }
        s = strm.state;
        wrap = s.wrap;
        if (wrap === 2 || wrap === 1 && s.status !== INIT_STATE || s.lookahead) {
          return Z_STREAM_ERROR;
        }
        if (wrap === 1) {
          strm.adler = adler32(strm.adler, dictionary, dictLength, 0);
        }
        s.wrap = 0;
        if (dictLength >= s.w_size) {
          if (wrap === 0) {
            zero(s.head);
            s.strstart = 0;
            s.block_start = 0;
            s.insert = 0;
          }
          tmpDict = new utils.Buf8(s.w_size);
          utils.arraySet(tmpDict, dictionary, dictLength - s.w_size, s.w_size, 0);
          dictionary = tmpDict;
          dictLength = s.w_size;
        }
        avail = strm.avail_in;
        next = strm.next_in;
        input = strm.input;
        strm.avail_in = dictLength;
        strm.next_in = 0;
        strm.input = dictionary;
        fill_window(s);
        while (s.lookahead >= MIN_MATCH) {
          str = s.strstart;
          n = s.lookahead - (MIN_MATCH - 1);
          do {
            s.ins_h = (s.ins_h << s.hash_shift ^ s.window[str + MIN_MATCH - 1]) & s.hash_mask;
            s.prev[str & s.w_mask] = s.head[s.ins_h];
            s.head[s.ins_h] = str;
            str++;
          } while (--n);
          s.strstart = str;
          s.lookahead = MIN_MATCH - 1;
          fill_window(s);
        }
        s.strstart += s.lookahead;
        s.block_start = s.strstart;
        s.insert = s.lookahead;
        s.lookahead = 0;
        s.match_length = s.prev_length = MIN_MATCH - 1;
        s.match_available = 0;
        strm.next_in = next;
        strm.input = input;
        strm.avail_in = avail;
        s.wrap = wrap;
        return Z_OK;
      }
      exports.deflateInit = deflateInit;
      exports.deflateInit2 = deflateInit2;
      exports.deflateReset = deflateReset;
      exports.deflateResetKeep = deflateResetKeep;
      exports.deflateSetHeader = deflateSetHeader;
      exports.deflate = deflate;
      exports.deflateEnd = deflateEnd;
      exports.deflateSetDictionary = deflateSetDictionary;
      exports.deflateInfo = "pako deflate (from Nodeca project)";
    }
  });

  // node_modules/pako/lib/utils/strings.js
  var require_strings = __commonJS({
    "node_modules/pako/lib/utils/strings.js"(exports) {
      "use strict";
      var utils = require_common();
      var STR_APPLY_OK = true;
      var STR_APPLY_UIA_OK = true;
      try {
        String.fromCharCode.apply(null, [0]);
      } catch (__) {
        STR_APPLY_OK = false;
      }
      try {
        String.fromCharCode.apply(null, new Uint8Array(1));
      } catch (__) {
        STR_APPLY_UIA_OK = false;
      }
      var _utf8len = new utils.Buf8(256);
      for (q = 0; q < 256; q++) {
        _utf8len[q] = q >= 252 ? 6 : q >= 248 ? 5 : q >= 240 ? 4 : q >= 224 ? 3 : q >= 192 ? 2 : 1;
      }
      var q;
      _utf8len[254] = _utf8len[254] = 1;
      exports.string2buf = function(str) {
        var buf, c, c2, m_pos, i, str_len = str.length, buf_len = 0;
        for (m_pos = 0; m_pos < str_len; m_pos++) {
          c = str.charCodeAt(m_pos);
          if ((c & 64512) === 55296 && m_pos + 1 < str_len) {
            c2 = str.charCodeAt(m_pos + 1);
            if ((c2 & 64512) === 56320) {
              c = 65536 + (c - 55296 << 10) + (c2 - 56320);
              m_pos++;
            }
          }
          buf_len += c < 128 ? 1 : c < 2048 ? 2 : c < 65536 ? 3 : 4;
        }
        buf = new utils.Buf8(buf_len);
        for (i = 0, m_pos = 0; i < buf_len; m_pos++) {
          c = str.charCodeAt(m_pos);
          if ((c & 64512) === 55296 && m_pos + 1 < str_len) {
            c2 = str.charCodeAt(m_pos + 1);
            if ((c2 & 64512) === 56320) {
              c = 65536 + (c - 55296 << 10) + (c2 - 56320);
              m_pos++;
            }
          }
          if (c < 128) {
            buf[i++] = c;
          } else if (c < 2048) {
            buf[i++] = 192 | c >>> 6;
            buf[i++] = 128 | c & 63;
          } else if (c < 65536) {
            buf[i++] = 224 | c >>> 12;
            buf[i++] = 128 | c >>> 6 & 63;
            buf[i++] = 128 | c & 63;
          } else {
            buf[i++] = 240 | c >>> 18;
            buf[i++] = 128 | c >>> 12 & 63;
            buf[i++] = 128 | c >>> 6 & 63;
            buf[i++] = 128 | c & 63;
          }
        }
        return buf;
      };
      function buf2binstring(buf, len) {
        if (len < 65534) {
          if (buf.subarray && STR_APPLY_UIA_OK || !buf.subarray && STR_APPLY_OK) {
            return String.fromCharCode.apply(null, utils.shrinkBuf(buf, len));
          }
        }
        var result = "";
        for (var i = 0; i < len; i++) {
          result += String.fromCharCode(buf[i]);
        }
        return result;
      }
      exports.buf2binstring = function(buf) {
        return buf2binstring(buf, buf.length);
      };
      exports.binstring2buf = function(str) {
        var buf = new utils.Buf8(str.length);
        for (var i = 0, len = buf.length; i < len; i++) {
          buf[i] = str.charCodeAt(i);
        }
        return buf;
      };
      exports.buf2string = function(buf, max) {
        var i, out, c, c_len;
        var len = max || buf.length;
        var utf16buf = new Array(len * 2);
        for (out = 0, i = 0; i < len; ) {
          c = buf[i++];
          if (c < 128) {
            utf16buf[out++] = c;
            continue;
          }
          c_len = _utf8len[c];
          if (c_len > 4) {
            utf16buf[out++] = 65533;
            i += c_len - 1;
            continue;
          }
          c &= c_len === 2 ? 31 : c_len === 3 ? 15 : 7;
          while (c_len > 1 && i < len) {
            c = c << 6 | buf[i++] & 63;
            c_len--;
          }
          if (c_len > 1) {
            utf16buf[out++] = 65533;
            continue;
          }
          if (c < 65536) {
            utf16buf[out++] = c;
          } else {
            c -= 65536;
            utf16buf[out++] = 55296 | c >> 10 & 1023;
            utf16buf[out++] = 56320 | c & 1023;
          }
        }
        return buf2binstring(utf16buf, out);
      };
      exports.utf8border = function(buf, max) {
        var pos;
        max = max || buf.length;
        if (max > buf.length) {
          max = buf.length;
        }
        pos = max - 1;
        while (pos >= 0 && (buf[pos] & 192) === 128) {
          pos--;
        }
        if (pos < 0) {
          return max;
        }
        if (pos === 0) {
          return max;
        }
        return pos + _utf8len[buf[pos]] > max ? pos : max;
      };
    }
  });

  // node_modules/pako/lib/zlib/zstream.js
  var require_zstream = __commonJS({
    "node_modules/pako/lib/zlib/zstream.js"(exports, module) {
      "use strict";
      function ZStream() {
        this.input = null;
        this.next_in = 0;
        this.avail_in = 0;
        this.total_in = 0;
        this.output = null;
        this.next_out = 0;
        this.avail_out = 0;
        this.total_out = 0;
        this.msg = "";
        this.state = null;
        this.data_type = 2;
        this.adler = 0;
      }
      module.exports = ZStream;
    }
  });

  // node_modules/pako/lib/deflate.js
  var require_deflate2 = __commonJS({
    "node_modules/pako/lib/deflate.js"(exports) {
      "use strict";
      var zlib_deflate = require_deflate();
      var utils = require_common();
      var strings = require_strings();
      var msg = require_messages();
      var ZStream = require_zstream();
      var toString = Object.prototype.toString;
      var Z_NO_FLUSH = 0;
      var Z_FINISH = 4;
      var Z_OK = 0;
      var Z_STREAM_END = 1;
      var Z_SYNC_FLUSH = 2;
      var Z_DEFAULT_COMPRESSION = -1;
      var Z_DEFAULT_STRATEGY = 0;
      var Z_DEFLATED = 8;
      function Deflate(options) {
        if (!(this instanceof Deflate)) return new Deflate(options);
        this.options = utils.assign({
          level: Z_DEFAULT_COMPRESSION,
          method: Z_DEFLATED,
          chunkSize: 16384,
          windowBits: 15,
          memLevel: 8,
          strategy: Z_DEFAULT_STRATEGY,
          to: ""
        }, options || {});
        var opt = this.options;
        if (opt.raw && opt.windowBits > 0) {
          opt.windowBits = -opt.windowBits;
        } else if (opt.gzip && opt.windowBits > 0 && opt.windowBits < 16) {
          opt.windowBits += 16;
        }
        this.err = 0;
        this.msg = "";
        this.ended = false;
        this.chunks = [];
        this.strm = new ZStream();
        this.strm.avail_out = 0;
        var status2 = zlib_deflate.deflateInit2(
          this.strm,
          opt.level,
          opt.method,
          opt.windowBits,
          opt.memLevel,
          opt.strategy
        );
        if (status2 !== Z_OK) {
          throw new Error(msg[status2]);
        }
        if (opt.header) {
          zlib_deflate.deflateSetHeader(this.strm, opt.header);
        }
        if (opt.dictionary) {
          var dict;
          if (typeof opt.dictionary === "string") {
            dict = strings.string2buf(opt.dictionary);
          } else if (toString.call(opt.dictionary) === "[object ArrayBuffer]") {
            dict = new Uint8Array(opt.dictionary);
          } else {
            dict = opt.dictionary;
          }
          status2 = zlib_deflate.deflateSetDictionary(this.strm, dict);
          if (status2 !== Z_OK) {
            throw new Error(msg[status2]);
          }
          this._dict_set = true;
        }
      }
      Deflate.prototype.push = function(data, mode) {
        var strm = this.strm;
        var chunkSize = this.options.chunkSize;
        var status2, _mode;
        if (this.ended) {
          return false;
        }
        _mode = mode === ~~mode ? mode : mode === true ? Z_FINISH : Z_NO_FLUSH;
        if (typeof data === "string") {
          strm.input = strings.string2buf(data);
        } else if (toString.call(data) === "[object ArrayBuffer]") {
          strm.input = new Uint8Array(data);
        } else {
          strm.input = data;
        }
        strm.next_in = 0;
        strm.avail_in = strm.input.length;
        do {
          if (strm.avail_out === 0) {
            strm.output = new utils.Buf8(chunkSize);
            strm.next_out = 0;
            strm.avail_out = chunkSize;
          }
          status2 = zlib_deflate.deflate(strm, _mode);
          if (status2 !== Z_STREAM_END && status2 !== Z_OK) {
            this.onEnd(status2);
            this.ended = true;
            return false;
          }
          if (strm.avail_out === 0 || strm.avail_in === 0 && (_mode === Z_FINISH || _mode === Z_SYNC_FLUSH)) {
            if (this.options.to === "string") {
              this.onData(strings.buf2binstring(utils.shrinkBuf(strm.output, strm.next_out)));
            } else {
              this.onData(utils.shrinkBuf(strm.output, strm.next_out));
            }
          }
        } while ((strm.avail_in > 0 || strm.avail_out === 0) && status2 !== Z_STREAM_END);
        if (_mode === Z_FINISH) {
          status2 = zlib_deflate.deflateEnd(this.strm);
          this.onEnd(status2);
          this.ended = true;
          return status2 === Z_OK;
        }
        if (_mode === Z_SYNC_FLUSH) {
          this.onEnd(Z_OK);
          strm.avail_out = 0;
          return true;
        }
        return true;
      };
      Deflate.prototype.onData = function(chunk) {
        this.chunks.push(chunk);
      };
      Deflate.prototype.onEnd = function(status2) {
        if (status2 === Z_OK) {
          if (this.options.to === "string") {
            this.result = this.chunks.join("");
          } else {
            this.result = utils.flattenChunks(this.chunks);
          }
        }
        this.chunks = [];
        this.err = status2;
        this.msg = this.strm.msg;
      };
      function deflate(input, options) {
        var deflator = new Deflate(options);
        deflator.push(input, true);
        if (deflator.err) {
          throw deflator.msg || msg[deflator.err];
        }
        return deflator.result;
      }
      function deflateRaw(input, options) {
        options = options || {};
        options.raw = true;
        return deflate(input, options);
      }
      function gzip(input, options) {
        options = options || {};
        options.gzip = true;
        return deflate(input, options);
      }
      exports.Deflate = Deflate;
      exports.deflate = deflate;
      exports.deflateRaw = deflateRaw;
      exports.gzip = gzip;
    }
  });

  // node_modules/pako/lib/zlib/inffast.js
  var require_inffast = __commonJS({
    "node_modules/pako/lib/zlib/inffast.js"(exports, module) {
      "use strict";
      var BAD = 30;
      var TYPE = 12;
      module.exports = function inflate_fast(strm, start) {
        var state;
        var _in;
        var last;
        var _out;
        var beg;
        var end;
        var dmax;
        var wsize;
        var whave;
        var wnext;
        var s_window;
        var hold;
        var bits;
        var lcode;
        var dcode;
        var lmask;
        var dmask;
        var here;
        var op;
        var len;
        var dist;
        var from;
        var from_source;
        var input, output2;
        state = strm.state;
        _in = strm.next_in;
        input = strm.input;
        last = _in + (strm.avail_in - 5);
        _out = strm.next_out;
        output2 = strm.output;
        beg = _out - (start - strm.avail_out);
        end = _out + (strm.avail_out - 257);
        dmax = state.dmax;
        wsize = state.wsize;
        whave = state.whave;
        wnext = state.wnext;
        s_window = state.window;
        hold = state.hold;
        bits = state.bits;
        lcode = state.lencode;
        dcode = state.distcode;
        lmask = (1 << state.lenbits) - 1;
        dmask = (1 << state.distbits) - 1;
        top:
          do {
            if (bits < 15) {
              hold += input[_in++] << bits;
              bits += 8;
              hold += input[_in++] << bits;
              bits += 8;
            }
            here = lcode[hold & lmask];
            dolen:
              for (; ; ) {
                op = here >>> 24;
                hold >>>= op;
                bits -= op;
                op = here >>> 16 & 255;
                if (op === 0) {
                  output2[_out++] = here & 65535;
                } else if (op & 16) {
                  len = here & 65535;
                  op &= 15;
                  if (op) {
                    if (bits < op) {
                      hold += input[_in++] << bits;
                      bits += 8;
                    }
                    len += hold & (1 << op) - 1;
                    hold >>>= op;
                    bits -= op;
                  }
                  if (bits < 15) {
                    hold += input[_in++] << bits;
                    bits += 8;
                    hold += input[_in++] << bits;
                    bits += 8;
                  }
                  here = dcode[hold & dmask];
                  dodist:
                    for (; ; ) {
                      op = here >>> 24;
                      hold >>>= op;
                      bits -= op;
                      op = here >>> 16 & 255;
                      if (op & 16) {
                        dist = here & 65535;
                        op &= 15;
                        if (bits < op) {
                          hold += input[_in++] << bits;
                          bits += 8;
                          if (bits < op) {
                            hold += input[_in++] << bits;
                            bits += 8;
                          }
                        }
                        dist += hold & (1 << op) - 1;
                        if (dist > dmax) {
                          strm.msg = "invalid distance too far back";
                          state.mode = BAD;
                          break top;
                        }
                        hold >>>= op;
                        bits -= op;
                        op = _out - beg;
                        if (dist > op) {
                          op = dist - op;
                          if (op > whave) {
                            if (state.sane) {
                              strm.msg = "invalid distance too far back";
                              state.mode = BAD;
                              break top;
                            }
                          }
                          from = 0;
                          from_source = s_window;
                          if (wnext === 0) {
                            from += wsize - op;
                            if (op < len) {
                              len -= op;
                              do {
                                output2[_out++] = s_window[from++];
                              } while (--op);
                              from = _out - dist;
                              from_source = output2;
                            }
                          } else if (wnext < op) {
                            from += wsize + wnext - op;
                            op -= wnext;
                            if (op < len) {
                              len -= op;
                              do {
                                output2[_out++] = s_window[from++];
                              } while (--op);
                              from = 0;
                              if (wnext < len) {
                                op = wnext;
                                len -= op;
                                do {
                                  output2[_out++] = s_window[from++];
                                } while (--op);
                                from = _out - dist;
                                from_source = output2;
                              }
                            }
                          } else {
                            from += wnext - op;
                            if (op < len) {
                              len -= op;
                              do {
                                output2[_out++] = s_window[from++];
                              } while (--op);
                              from = _out - dist;
                              from_source = output2;
                            }
                          }
                          while (len > 2) {
                            output2[_out++] = from_source[from++];
                            output2[_out++] = from_source[from++];
                            output2[_out++] = from_source[from++];
                            len -= 3;
                          }
                          if (len) {
                            output2[_out++] = from_source[from++];
                            if (len > 1) {
                              output2[_out++] = from_source[from++];
                            }
                          }
                        } else {
                          from = _out - dist;
                          do {
                            output2[_out++] = output2[from++];
                            output2[_out++] = output2[from++];
                            output2[_out++] = output2[from++];
                            len -= 3;
                          } while (len > 2);
                          if (len) {
                            output2[_out++] = output2[from++];
                            if (len > 1) {
                              output2[_out++] = output2[from++];
                            }
                          }
                        }
                      } else if ((op & 64) === 0) {
                        here = dcode[(here & 65535) + (hold & (1 << op) - 1)];
                        continue dodist;
                      } else {
                        strm.msg = "invalid distance code";
                        state.mode = BAD;
                        break top;
                      }
                      break;
                    }
                } else if ((op & 64) === 0) {
                  here = lcode[(here & 65535) + (hold & (1 << op) - 1)];
                  continue dolen;
                } else if (op & 32) {
                  state.mode = TYPE;
                  break top;
                } else {
                  strm.msg = "invalid literal/length code";
                  state.mode = BAD;
                  break top;
                }
                break;
              }
          } while (_in < last && _out < end);
        len = bits >> 3;
        _in -= len;
        bits -= len << 3;
        hold &= (1 << bits) - 1;
        strm.next_in = _in;
        strm.next_out = _out;
        strm.avail_in = _in < last ? 5 + (last - _in) : 5 - (_in - last);
        strm.avail_out = _out < end ? 257 + (end - _out) : 257 - (_out - end);
        state.hold = hold;
        state.bits = bits;
        return;
      };
    }
  });

  // node_modules/pako/lib/zlib/inftrees.js
  var require_inftrees = __commonJS({
    "node_modules/pako/lib/zlib/inftrees.js"(exports, module) {
      "use strict";
      var utils = require_common();
      var MAXBITS = 15;
      var ENOUGH_LENS = 852;
      var ENOUGH_DISTS = 592;
      var CODES = 0;
      var LENS = 1;
      var DISTS = 2;
      var lbase = [
        /* Length codes 257..285 base */
        3,
        4,
        5,
        6,
        7,
        8,
        9,
        10,
        11,
        13,
        15,
        17,
        19,
        23,
        27,
        31,
        35,
        43,
        51,
        59,
        67,
        83,
        99,
        115,
        131,
        163,
        195,
        227,
        258,
        0,
        0
      ];
      var lext = [
        /* Length codes 257..285 extra */
        16,
        16,
        16,
        16,
        16,
        16,
        16,
        16,
        17,
        17,
        17,
        17,
        18,
        18,
        18,
        18,
        19,
        19,
        19,
        19,
        20,
        20,
        20,
        20,
        21,
        21,
        21,
        21,
        16,
        72,
        78
      ];
      var dbase = [
        /* Distance codes 0..29 base */
        1,
        2,
        3,
        4,
        5,
        7,
        9,
        13,
        17,
        25,
        33,
        49,
        65,
        97,
        129,
        193,
        257,
        385,
        513,
        769,
        1025,
        1537,
        2049,
        3073,
        4097,
        6145,
        8193,
        12289,
        16385,
        24577,
        0,
        0
      ];
      var dext = [
        /* Distance codes 0..29 extra */
        16,
        16,
        16,
        16,
        17,
        17,
        18,
        18,
        19,
        19,
        20,
        20,
        21,
        21,
        22,
        22,
        23,
        23,
        24,
        24,
        25,
        25,
        26,
        26,
        27,
        27,
        28,
        28,
        29,
        29,
        64,
        64
      ];
      module.exports = function inflate_table(type, lens, lens_index, codes, table, table_index, work, opts) {
        var bits = opts.bits;
        var len = 0;
        var sym = 0;
        var min = 0, max = 0;
        var root = 0;
        var curr = 0;
        var drop = 0;
        var left = 0;
        var used = 0;
        var huff = 0;
        var incr;
        var fill;
        var low;
        var mask;
        var next;
        var base = null;
        var base_index = 0;
        var end;
        var count = new utils.Buf16(MAXBITS + 1);
        var offs = new utils.Buf16(MAXBITS + 1);
        var extra = null;
        var extra_index = 0;
        var here_bits, here_op, here_val;
        for (len = 0; len <= MAXBITS; len++) {
          count[len] = 0;
        }
        for (sym = 0; sym < codes; sym++) {
          count[lens[lens_index + sym]]++;
        }
        root = bits;
        for (max = MAXBITS; max >= 1; max--) {
          if (count[max] !== 0) {
            break;
          }
        }
        if (root > max) {
          root = max;
        }
        if (max === 0) {
          table[table_index++] = 1 << 24 | 64 << 16 | 0;
          table[table_index++] = 1 << 24 | 64 << 16 | 0;
          opts.bits = 1;
          return 0;
        }
        for (min = 1; min < max; min++) {
          if (count[min] !== 0) {
            break;
          }
        }
        if (root < min) {
          root = min;
        }
        left = 1;
        for (len = 1; len <= MAXBITS; len++) {
          left <<= 1;
          left -= count[len];
          if (left < 0) {
            return -1;
          }
        }
        if (left > 0 && (type === CODES || max !== 1)) {
          return -1;
        }
        offs[1] = 0;
        for (len = 1; len < MAXBITS; len++) {
          offs[len + 1] = offs[len] + count[len];
        }
        for (sym = 0; sym < codes; sym++) {
          if (lens[lens_index + sym] !== 0) {
            work[offs[lens[lens_index + sym]]++] = sym;
          }
        }
        if (type === CODES) {
          base = extra = work;
          end = 19;
        } else if (type === LENS) {
          base = lbase;
          base_index -= 257;
          extra = lext;
          extra_index -= 257;
          end = 256;
        } else {
          base = dbase;
          extra = dext;
          end = -1;
        }
        huff = 0;
        sym = 0;
        len = min;
        next = table_index;
        curr = root;
        drop = 0;
        low = -1;
        used = 1 << root;
        mask = used - 1;
        if (type === LENS && used > ENOUGH_LENS || type === DISTS && used > ENOUGH_DISTS) {
          return 1;
        }
        for (; ; ) {
          here_bits = len - drop;
          if (work[sym] < end) {
            here_op = 0;
            here_val = work[sym];
          } else if (work[sym] > end) {
            here_op = extra[extra_index + work[sym]];
            here_val = base[base_index + work[sym]];
          } else {
            here_op = 32 + 64;
            here_val = 0;
          }
          incr = 1 << len - drop;
          fill = 1 << curr;
          min = fill;
          do {
            fill -= incr;
            table[next + (huff >> drop) + fill] = here_bits << 24 | here_op << 16 | here_val | 0;
          } while (fill !== 0);
          incr = 1 << len - 1;
          while (huff & incr) {
            incr >>= 1;
          }
          if (incr !== 0) {
            huff &= incr - 1;
            huff += incr;
          } else {
            huff = 0;
          }
          sym++;
          if (--count[len] === 0) {
            if (len === max) {
              break;
            }
            len = lens[lens_index + work[sym]];
          }
          if (len > root && (huff & mask) !== low) {
            if (drop === 0) {
              drop = root;
            }
            next += min;
            curr = len - drop;
            left = 1 << curr;
            while (curr + drop < max) {
              left -= count[curr + drop];
              if (left <= 0) {
                break;
              }
              curr++;
              left <<= 1;
            }
            used += 1 << curr;
            if (type === LENS && used > ENOUGH_LENS || type === DISTS && used > ENOUGH_DISTS) {
              return 1;
            }
            low = huff & mask;
            table[low] = root << 24 | curr << 16 | next - table_index | 0;
          }
        }
        if (huff !== 0) {
          table[next + huff] = len - drop << 24 | 64 << 16 | 0;
        }
        opts.bits = root;
        return 0;
      };
    }
  });

  // node_modules/pako/lib/zlib/inflate.js
  var require_inflate = __commonJS({
    "node_modules/pako/lib/zlib/inflate.js"(exports) {
      "use strict";
      var utils = require_common();
      var adler32 = require_adler32();
      var crc322 = require_crc32();
      var inflate_fast = require_inffast();
      var inflate_table = require_inftrees();
      var CODES = 0;
      var LENS = 1;
      var DISTS = 2;
      var Z_FINISH = 4;
      var Z_BLOCK = 5;
      var Z_TREES = 6;
      var Z_OK = 0;
      var Z_STREAM_END = 1;
      var Z_NEED_DICT = 2;
      var Z_STREAM_ERROR = -2;
      var Z_DATA_ERROR = -3;
      var Z_MEM_ERROR = -4;
      var Z_BUF_ERROR = -5;
      var Z_DEFLATED = 8;
      var HEAD = 1;
      var FLAGS = 2;
      var TIME = 3;
      var OS = 4;
      var EXLEN = 5;
      var EXTRA = 6;
      var NAME = 7;
      var COMMENT = 8;
      var HCRC = 9;
      var DICTID = 10;
      var DICT = 11;
      var TYPE = 12;
      var TYPEDO = 13;
      var STORED = 14;
      var COPY_ = 15;
      var COPY = 16;
      var TABLE = 17;
      var LENLENS = 18;
      var CODELENS = 19;
      var LEN_ = 20;
      var LEN = 21;
      var LENEXT = 22;
      var DIST = 23;
      var DISTEXT = 24;
      var MATCH = 25;
      var LIT = 26;
      var CHECK = 27;
      var LENGTH = 28;
      var DONE = 29;
      var BAD = 30;
      var MEM = 31;
      var SYNC = 32;
      var ENOUGH_LENS = 852;
      var ENOUGH_DISTS = 592;
      var MAX_WBITS = 15;
      var DEF_WBITS = MAX_WBITS;
      function zswap32(q) {
        return (q >>> 24 & 255) + (q >>> 8 & 65280) + ((q & 65280) << 8) + ((q & 255) << 24);
      }
      function InflateState() {
        this.mode = 0;
        this.last = false;
        this.wrap = 0;
        this.havedict = false;
        this.flags = 0;
        this.dmax = 0;
        this.check = 0;
        this.total = 0;
        this.head = null;
        this.wbits = 0;
        this.wsize = 0;
        this.whave = 0;
        this.wnext = 0;
        this.window = null;
        this.hold = 0;
        this.bits = 0;
        this.length = 0;
        this.offset = 0;
        this.extra = 0;
        this.lencode = null;
        this.distcode = null;
        this.lenbits = 0;
        this.distbits = 0;
        this.ncode = 0;
        this.nlen = 0;
        this.ndist = 0;
        this.have = 0;
        this.next = null;
        this.lens = new utils.Buf16(320);
        this.work = new utils.Buf16(288);
        this.lendyn = null;
        this.distdyn = null;
        this.sane = 0;
        this.back = 0;
        this.was = 0;
      }
      function inflateResetKeep(strm) {
        var state;
        if (!strm || !strm.state) {
          return Z_STREAM_ERROR;
        }
        state = strm.state;
        strm.total_in = strm.total_out = state.total = 0;
        strm.msg = "";
        if (state.wrap) {
          strm.adler = state.wrap & 1;
        }
        state.mode = HEAD;
        state.last = 0;
        state.havedict = 0;
        state.dmax = 32768;
        state.head = null;
        state.hold = 0;
        state.bits = 0;
        state.lencode = state.lendyn = new utils.Buf32(ENOUGH_LENS);
        state.distcode = state.distdyn = new utils.Buf32(ENOUGH_DISTS);
        state.sane = 1;
        state.back = -1;
        return Z_OK;
      }
      function inflateReset(strm) {
        var state;
        if (!strm || !strm.state) {
          return Z_STREAM_ERROR;
        }
        state = strm.state;
        state.wsize = 0;
        state.whave = 0;
        state.wnext = 0;
        return inflateResetKeep(strm);
      }
      function inflateReset2(strm, windowBits) {
        var wrap;
        var state;
        if (!strm || !strm.state) {
          return Z_STREAM_ERROR;
        }
        state = strm.state;
        if (windowBits < 0) {
          wrap = 0;
          windowBits = -windowBits;
        } else {
          wrap = (windowBits >> 4) + 1;
          if (windowBits < 48) {
            windowBits &= 15;
          }
        }
        if (windowBits && (windowBits < 8 || windowBits > 15)) {
          return Z_STREAM_ERROR;
        }
        if (state.window !== null && state.wbits !== windowBits) {
          state.window = null;
        }
        state.wrap = wrap;
        state.wbits = windowBits;
        return inflateReset(strm);
      }
      function inflateInit2(strm, windowBits) {
        var ret;
        var state;
        if (!strm) {
          return Z_STREAM_ERROR;
        }
        state = new InflateState();
        strm.state = state;
        state.window = null;
        ret = inflateReset2(strm, windowBits);
        if (ret !== Z_OK) {
          strm.state = null;
        }
        return ret;
      }
      function inflateInit(strm) {
        return inflateInit2(strm, DEF_WBITS);
      }
      var virgin = true;
      var lenfix;
      var distfix;
      function fixedtables(state) {
        if (virgin) {
          var sym;
          lenfix = new utils.Buf32(512);
          distfix = new utils.Buf32(32);
          sym = 0;
          while (sym < 144) {
            state.lens[sym++] = 8;
          }
          while (sym < 256) {
            state.lens[sym++] = 9;
          }
          while (sym < 280) {
            state.lens[sym++] = 7;
          }
          while (sym < 288) {
            state.lens[sym++] = 8;
          }
          inflate_table(LENS, state.lens, 0, 288, lenfix, 0, state.work, { bits: 9 });
          sym = 0;
          while (sym < 32) {
            state.lens[sym++] = 5;
          }
          inflate_table(DISTS, state.lens, 0, 32, distfix, 0, state.work, { bits: 5 });
          virgin = false;
        }
        state.lencode = lenfix;
        state.lenbits = 9;
        state.distcode = distfix;
        state.distbits = 5;
      }
      function updatewindow(strm, src, end, copy) {
        var dist;
        var state = strm.state;
        if (state.window === null) {
          state.wsize = 1 << state.wbits;
          state.wnext = 0;
          state.whave = 0;
          state.window = new utils.Buf8(state.wsize);
        }
        if (copy >= state.wsize) {
          utils.arraySet(state.window, src, end - state.wsize, state.wsize, 0);
          state.wnext = 0;
          state.whave = state.wsize;
        } else {
          dist = state.wsize - state.wnext;
          if (dist > copy) {
            dist = copy;
          }
          utils.arraySet(state.window, src, end - copy, dist, state.wnext);
          copy -= dist;
          if (copy) {
            utils.arraySet(state.window, src, end - copy, copy, 0);
            state.wnext = copy;
            state.whave = state.wsize;
          } else {
            state.wnext += dist;
            if (state.wnext === state.wsize) {
              state.wnext = 0;
            }
            if (state.whave < state.wsize) {
              state.whave += dist;
            }
          }
        }
        return 0;
      }
      function inflate(strm, flush) {
        var state;
        var input, output2;
        var next;
        var put;
        var have, left;
        var hold;
        var bits;
        var _in, _out;
        var copy;
        var from;
        var from_source;
        var here = 0;
        var here_bits, here_op, here_val;
        var last_bits, last_op, last_val;
        var len;
        var ret;
        var hbuf = new utils.Buf8(4);
        var opts;
        var n;
        var order = (
          /* permutation of code lengths */
          [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]
        );
        if (!strm || !strm.state || !strm.output || !strm.input && strm.avail_in !== 0) {
          return Z_STREAM_ERROR;
        }
        state = strm.state;
        if (state.mode === TYPE) {
          state.mode = TYPEDO;
        }
        put = strm.next_out;
        output2 = strm.output;
        left = strm.avail_out;
        next = strm.next_in;
        input = strm.input;
        have = strm.avail_in;
        hold = state.hold;
        bits = state.bits;
        _in = have;
        _out = left;
        ret = Z_OK;
        inf_leave:
          for (; ; ) {
            switch (state.mode) {
              case HEAD:
                if (state.wrap === 0) {
                  state.mode = TYPEDO;
                  break;
                }
                while (bits < 16) {
                  if (have === 0) {
                    break inf_leave;
                  }
                  have--;
                  hold += input[next++] << bits;
                  bits += 8;
                }
                if (state.wrap & 2 && hold === 35615) {
                  state.check = 0;
                  hbuf[0] = hold & 255;
                  hbuf[1] = hold >>> 8 & 255;
                  state.check = crc322(state.check, hbuf, 2, 0);
                  hold = 0;
                  bits = 0;
                  state.mode = FLAGS;
                  break;
                }
                state.flags = 0;
                if (state.head) {
                  state.head.done = false;
                }
                if (!(state.wrap & 1) || /* check if zlib header allowed */
                (((hold & 255) << 8) + (hold >> 8)) % 31) {
                  strm.msg = "incorrect header check";
                  state.mode = BAD;
                  break;
                }
                if ((hold & 15) !== Z_DEFLATED) {
                  strm.msg = "unknown compression method";
                  state.mode = BAD;
                  break;
                }
                hold >>>= 4;
                bits -= 4;
                len = (hold & 15) + 8;
                if (state.wbits === 0) {
                  state.wbits = len;
                } else if (len > state.wbits) {
                  strm.msg = "invalid window size";
                  state.mode = BAD;
                  break;
                }
                state.dmax = 1 << len;
                strm.adler = state.check = 1;
                state.mode = hold & 512 ? DICTID : TYPE;
                hold = 0;
                bits = 0;
                break;
              case FLAGS:
                while (bits < 16) {
                  if (have === 0) {
                    break inf_leave;
                  }
                  have--;
                  hold += input[next++] << bits;
                  bits += 8;
                }
                state.flags = hold;
                if ((state.flags & 255) !== Z_DEFLATED) {
                  strm.msg = "unknown compression method";
                  state.mode = BAD;
                  break;
                }
                if (state.flags & 57344) {
                  strm.msg = "unknown header flags set";
                  state.mode = BAD;
                  break;
                }
                if (state.head) {
                  state.head.text = hold >> 8 & 1;
                }
                if (state.flags & 512) {
                  hbuf[0] = hold & 255;
                  hbuf[1] = hold >>> 8 & 255;
                  state.check = crc322(state.check, hbuf, 2, 0);
                }
                hold = 0;
                bits = 0;
                state.mode = TIME;
              /* falls through */
              case TIME:
                while (bits < 32) {
                  if (have === 0) {
                    break inf_leave;
                  }
                  have--;
                  hold += input[next++] << bits;
                  bits += 8;
                }
                if (state.head) {
                  state.head.time = hold;
                }
                if (state.flags & 512) {
                  hbuf[0] = hold & 255;
                  hbuf[1] = hold >>> 8 & 255;
                  hbuf[2] = hold >>> 16 & 255;
                  hbuf[3] = hold >>> 24 & 255;
                  state.check = crc322(state.check, hbuf, 4, 0);
                }
                hold = 0;
                bits = 0;
                state.mode = OS;
              /* falls through */
              case OS:
                while (bits < 16) {
                  if (have === 0) {
                    break inf_leave;
                  }
                  have--;
                  hold += input[next++] << bits;
                  bits += 8;
                }
                if (state.head) {
                  state.head.xflags = hold & 255;
                  state.head.os = hold >> 8;
                }
                if (state.flags & 512) {
                  hbuf[0] = hold & 255;
                  hbuf[1] = hold >>> 8 & 255;
                  state.check = crc322(state.check, hbuf, 2, 0);
                }
                hold = 0;
                bits = 0;
                state.mode = EXLEN;
              /* falls through */
              case EXLEN:
                if (state.flags & 1024) {
                  while (bits < 16) {
                    if (have === 0) {
                      break inf_leave;
                    }
                    have--;
                    hold += input[next++] << bits;
                    bits += 8;
                  }
                  state.length = hold;
                  if (state.head) {
                    state.head.extra_len = hold;
                  }
                  if (state.flags & 512) {
                    hbuf[0] = hold & 255;
                    hbuf[1] = hold >>> 8 & 255;
                    state.check = crc322(state.check, hbuf, 2, 0);
                  }
                  hold = 0;
                  bits = 0;
                } else if (state.head) {
                  state.head.extra = null;
                }
                state.mode = EXTRA;
              /* falls through */
              case EXTRA:
                if (state.flags & 1024) {
                  copy = state.length;
                  if (copy > have) {
                    copy = have;
                  }
                  if (copy) {
                    if (state.head) {
                      len = state.head.extra_len - state.length;
                      if (!state.head.extra) {
                        state.head.extra = new Array(state.head.extra_len);
                      }
                      utils.arraySet(
                        state.head.extra,
                        input,
                        next,
                        // extra field is limited to 65536 bytes
                        // - no need for additional size check
                        copy,
                        /*len + copy > state.head.extra_max - len ? state.head.extra_max : copy,*/
                        len
                      );
                    }
                    if (state.flags & 512) {
                      state.check = crc322(state.check, input, copy, next);
                    }
                    have -= copy;
                    next += copy;
                    state.length -= copy;
                  }
                  if (state.length) {
                    break inf_leave;
                  }
                }
                state.length = 0;
                state.mode = NAME;
              /* falls through */
              case NAME:
                if (state.flags & 2048) {
                  if (have === 0) {
                    break inf_leave;
                  }
                  copy = 0;
                  do {
                    len = input[next + copy++];
                    if (state.head && len && state.length < 65536) {
                      state.head.name += String.fromCharCode(len);
                    }
                  } while (len && copy < have);
                  if (state.flags & 512) {
                    state.check = crc322(state.check, input, copy, next);
                  }
                  have -= copy;
                  next += copy;
                  if (len) {
                    break inf_leave;
                  }
                } else if (state.head) {
                  state.head.name = null;
                }
                state.length = 0;
                state.mode = COMMENT;
              /* falls through */
              case COMMENT:
                if (state.flags & 4096) {
                  if (have === 0) {
                    break inf_leave;
                  }
                  copy = 0;
                  do {
                    len = input[next + copy++];
                    if (state.head && len && state.length < 65536) {
                      state.head.comment += String.fromCharCode(len);
                    }
                  } while (len && copy < have);
                  if (state.flags & 512) {
                    state.check = crc322(state.check, input, copy, next);
                  }
                  have -= copy;
                  next += copy;
                  if (len) {
                    break inf_leave;
                  }
                } else if (state.head) {
                  state.head.comment = null;
                }
                state.mode = HCRC;
              /* falls through */
              case HCRC:
                if (state.flags & 512) {
                  while (bits < 16) {
                    if (have === 0) {
                      break inf_leave;
                    }
                    have--;
                    hold += input[next++] << bits;
                    bits += 8;
                  }
                  if (hold !== (state.check & 65535)) {
                    strm.msg = "header crc mismatch";
                    state.mode = BAD;
                    break;
                  }
                  hold = 0;
                  bits = 0;
                }
                if (state.head) {
                  state.head.hcrc = state.flags >> 9 & 1;
                  state.head.done = true;
                }
                strm.adler = state.check = 0;
                state.mode = TYPE;
                break;
              case DICTID:
                while (bits < 32) {
                  if (have === 0) {
                    break inf_leave;
                  }
                  have--;
                  hold += input[next++] << bits;
                  bits += 8;
                }
                strm.adler = state.check = zswap32(hold);
                hold = 0;
                bits = 0;
                state.mode = DICT;
              /* falls through */
              case DICT:
                if (state.havedict === 0) {
                  strm.next_out = put;
                  strm.avail_out = left;
                  strm.next_in = next;
                  strm.avail_in = have;
                  state.hold = hold;
                  state.bits = bits;
                  return Z_NEED_DICT;
                }
                strm.adler = state.check = 1;
                state.mode = TYPE;
              /* falls through */
              case TYPE:
                if (flush === Z_BLOCK || flush === Z_TREES) {
                  break inf_leave;
                }
              /* falls through */
              case TYPEDO:
                if (state.last) {
                  hold >>>= bits & 7;
                  bits -= bits & 7;
                  state.mode = CHECK;
                  break;
                }
                while (bits < 3) {
                  if (have === 0) {
                    break inf_leave;
                  }
                  have--;
                  hold += input[next++] << bits;
                  bits += 8;
                }
                state.last = hold & 1;
                hold >>>= 1;
                bits -= 1;
                switch (hold & 3) {
                  case 0:
                    state.mode = STORED;
                    break;
                  case 1:
                    fixedtables(state);
                    state.mode = LEN_;
                    if (flush === Z_TREES) {
                      hold >>>= 2;
                      bits -= 2;
                      break inf_leave;
                    }
                    break;
                  case 2:
                    state.mode = TABLE;
                    break;
                  case 3:
                    strm.msg = "invalid block type";
                    state.mode = BAD;
                }
                hold >>>= 2;
                bits -= 2;
                break;
              case STORED:
                hold >>>= bits & 7;
                bits -= bits & 7;
                while (bits < 32) {
                  if (have === 0) {
                    break inf_leave;
                  }
                  have--;
                  hold += input[next++] << bits;
                  bits += 8;
                }
                if ((hold & 65535) !== (hold >>> 16 ^ 65535)) {
                  strm.msg = "invalid stored block lengths";
                  state.mode = BAD;
                  break;
                }
                state.length = hold & 65535;
                hold = 0;
                bits = 0;
                state.mode = COPY_;
                if (flush === Z_TREES) {
                  break inf_leave;
                }
              /* falls through */
              case COPY_:
                state.mode = COPY;
              /* falls through */
              case COPY:
                copy = state.length;
                if (copy) {
                  if (copy > have) {
                    copy = have;
                  }
                  if (copy > left) {
                    copy = left;
                  }
                  if (copy === 0) {
                    break inf_leave;
                  }
                  utils.arraySet(output2, input, next, copy, put);
                  have -= copy;
                  next += copy;
                  left -= copy;
                  put += copy;
                  state.length -= copy;
                  break;
                }
                state.mode = TYPE;
                break;
              case TABLE:
                while (bits < 14) {
                  if (have === 0) {
                    break inf_leave;
                  }
                  have--;
                  hold += input[next++] << bits;
                  bits += 8;
                }
                state.nlen = (hold & 31) + 257;
                hold >>>= 5;
                bits -= 5;
                state.ndist = (hold & 31) + 1;
                hold >>>= 5;
                bits -= 5;
                state.ncode = (hold & 15) + 4;
                hold >>>= 4;
                bits -= 4;
                if (state.nlen > 286 || state.ndist > 30) {
                  strm.msg = "too many length or distance symbols";
                  state.mode = BAD;
                  break;
                }
                state.have = 0;
                state.mode = LENLENS;
              /* falls through */
              case LENLENS:
                while (state.have < state.ncode) {
                  while (bits < 3) {
                    if (have === 0) {
                      break inf_leave;
                    }
                    have--;
                    hold += input[next++] << bits;
                    bits += 8;
                  }
                  state.lens[order[state.have++]] = hold & 7;
                  hold >>>= 3;
                  bits -= 3;
                }
                while (state.have < 19) {
                  state.lens[order[state.have++]] = 0;
                }
                state.lencode = state.lendyn;
                state.lenbits = 7;
                opts = { bits: state.lenbits };
                ret = inflate_table(CODES, state.lens, 0, 19, state.lencode, 0, state.work, opts);
                state.lenbits = opts.bits;
                if (ret) {
                  strm.msg = "invalid code lengths set";
                  state.mode = BAD;
                  break;
                }
                state.have = 0;
                state.mode = CODELENS;
              /* falls through */
              case CODELENS:
                while (state.have < state.nlen + state.ndist) {
                  for (; ; ) {
                    here = state.lencode[hold & (1 << state.lenbits) - 1];
                    here_bits = here >>> 24;
                    here_op = here >>> 16 & 255;
                    here_val = here & 65535;
                    if (here_bits <= bits) {
                      break;
                    }
                    if (have === 0) {
                      break inf_leave;
                    }
                    have--;
                    hold += input[next++] << bits;
                    bits += 8;
                  }
                  if (here_val < 16) {
                    hold >>>= here_bits;
                    bits -= here_bits;
                    state.lens[state.have++] = here_val;
                  } else {
                    if (here_val === 16) {
                      n = here_bits + 2;
                      while (bits < n) {
                        if (have === 0) {
                          break inf_leave;
                        }
                        have--;
                        hold += input[next++] << bits;
                        bits += 8;
                      }
                      hold >>>= here_bits;
                      bits -= here_bits;
                      if (state.have === 0) {
                        strm.msg = "invalid bit length repeat";
                        state.mode = BAD;
                        break;
                      }
                      len = state.lens[state.have - 1];
                      copy = 3 + (hold & 3);
                      hold >>>= 2;
                      bits -= 2;
                    } else if (here_val === 17) {
                      n = here_bits + 3;
                      while (bits < n) {
                        if (have === 0) {
                          break inf_leave;
                        }
                        have--;
                        hold += input[next++] << bits;
                        bits += 8;
                      }
                      hold >>>= here_bits;
                      bits -= here_bits;
                      len = 0;
                      copy = 3 + (hold & 7);
                      hold >>>= 3;
                      bits -= 3;
                    } else {
                      n = here_bits + 7;
                      while (bits < n) {
                        if (have === 0) {
                          break inf_leave;
                        }
                        have--;
                        hold += input[next++] << bits;
                        bits += 8;
                      }
                      hold >>>= here_bits;
                      bits -= here_bits;
                      len = 0;
                      copy = 11 + (hold & 127);
                      hold >>>= 7;
                      bits -= 7;
                    }
                    if (state.have + copy > state.nlen + state.ndist) {
                      strm.msg = "invalid bit length repeat";
                      state.mode = BAD;
                      break;
                    }
                    while (copy--) {
                      state.lens[state.have++] = len;
                    }
                  }
                }
                if (state.mode === BAD) {
                  break;
                }
                if (state.lens[256] === 0) {
                  strm.msg = "invalid code -- missing end-of-block";
                  state.mode = BAD;
                  break;
                }
                state.lenbits = 9;
                opts = { bits: state.lenbits };
                ret = inflate_table(LENS, state.lens, 0, state.nlen, state.lencode, 0, state.work, opts);
                state.lenbits = opts.bits;
                if (ret) {
                  strm.msg = "invalid literal/lengths set";
                  state.mode = BAD;
                  break;
                }
                state.distbits = 6;
                state.distcode = state.distdyn;
                opts = { bits: state.distbits };
                ret = inflate_table(DISTS, state.lens, state.nlen, state.ndist, state.distcode, 0, state.work, opts);
                state.distbits = opts.bits;
                if (ret) {
                  strm.msg = "invalid distances set";
                  state.mode = BAD;
                  break;
                }
                state.mode = LEN_;
                if (flush === Z_TREES) {
                  break inf_leave;
                }
              /* falls through */
              case LEN_:
                state.mode = LEN;
              /* falls through */
              case LEN:
                if (have >= 6 && left >= 258) {
                  strm.next_out = put;
                  strm.avail_out = left;
                  strm.next_in = next;
                  strm.avail_in = have;
                  state.hold = hold;
                  state.bits = bits;
                  inflate_fast(strm, _out);
                  put = strm.next_out;
                  output2 = strm.output;
                  left = strm.avail_out;
                  next = strm.next_in;
                  input = strm.input;
                  have = strm.avail_in;
                  hold = state.hold;
                  bits = state.bits;
                  if (state.mode === TYPE) {
                    state.back = -1;
                  }
                  break;
                }
                state.back = 0;
                for (; ; ) {
                  here = state.lencode[hold & (1 << state.lenbits) - 1];
                  here_bits = here >>> 24;
                  here_op = here >>> 16 & 255;
                  here_val = here & 65535;
                  if (here_bits <= bits) {
                    break;
                  }
                  if (have === 0) {
                    break inf_leave;
                  }
                  have--;
                  hold += input[next++] << bits;
                  bits += 8;
                }
                if (here_op && (here_op & 240) === 0) {
                  last_bits = here_bits;
                  last_op = here_op;
                  last_val = here_val;
                  for (; ; ) {
                    here = state.lencode[last_val + ((hold & (1 << last_bits + last_op) - 1) >> last_bits)];
                    here_bits = here >>> 24;
                    here_op = here >>> 16 & 255;
                    here_val = here & 65535;
                    if (last_bits + here_bits <= bits) {
                      break;
                    }
                    if (have === 0) {
                      break inf_leave;
                    }
                    have--;
                    hold += input[next++] << bits;
                    bits += 8;
                  }
                  hold >>>= last_bits;
                  bits -= last_bits;
                  state.back += last_bits;
                }
                hold >>>= here_bits;
                bits -= here_bits;
                state.back += here_bits;
                state.length = here_val;
                if (here_op === 0) {
                  state.mode = LIT;
                  break;
                }
                if (here_op & 32) {
                  state.back = -1;
                  state.mode = TYPE;
                  break;
                }
                if (here_op & 64) {
                  strm.msg = "invalid literal/length code";
                  state.mode = BAD;
                  break;
                }
                state.extra = here_op & 15;
                state.mode = LENEXT;
              /* falls through */
              case LENEXT:
                if (state.extra) {
                  n = state.extra;
                  while (bits < n) {
                    if (have === 0) {
                      break inf_leave;
                    }
                    have--;
                    hold += input[next++] << bits;
                    bits += 8;
                  }
                  state.length += hold & (1 << state.extra) - 1;
                  hold >>>= state.extra;
                  bits -= state.extra;
                  state.back += state.extra;
                }
                state.was = state.length;
                state.mode = DIST;
              /* falls through */
              case DIST:
                for (; ; ) {
                  here = state.distcode[hold & (1 << state.distbits) - 1];
                  here_bits = here >>> 24;
                  here_op = here >>> 16 & 255;
                  here_val = here & 65535;
                  if (here_bits <= bits) {
                    break;
                  }
                  if (have === 0) {
                    break inf_leave;
                  }
                  have--;
                  hold += input[next++] << bits;
                  bits += 8;
                }
                if ((here_op & 240) === 0) {
                  last_bits = here_bits;
                  last_op = here_op;
                  last_val = here_val;
                  for (; ; ) {
                    here = state.distcode[last_val + ((hold & (1 << last_bits + last_op) - 1) >> last_bits)];
                    here_bits = here >>> 24;
                    here_op = here >>> 16 & 255;
                    here_val = here & 65535;
                    if (last_bits + here_bits <= bits) {
                      break;
                    }
                    if (have === 0) {
                      break inf_leave;
                    }
                    have--;
                    hold += input[next++] << bits;
                    bits += 8;
                  }
                  hold >>>= last_bits;
                  bits -= last_bits;
                  state.back += last_bits;
                }
                hold >>>= here_bits;
                bits -= here_bits;
                state.back += here_bits;
                if (here_op & 64) {
                  strm.msg = "invalid distance code";
                  state.mode = BAD;
                  break;
                }
                state.offset = here_val;
                state.extra = here_op & 15;
                state.mode = DISTEXT;
              /* falls through */
              case DISTEXT:
                if (state.extra) {
                  n = state.extra;
                  while (bits < n) {
                    if (have === 0) {
                      break inf_leave;
                    }
                    have--;
                    hold += input[next++] << bits;
                    bits += 8;
                  }
                  state.offset += hold & (1 << state.extra) - 1;
                  hold >>>= state.extra;
                  bits -= state.extra;
                  state.back += state.extra;
                }
                if (state.offset > state.dmax) {
                  strm.msg = "invalid distance too far back";
                  state.mode = BAD;
                  break;
                }
                state.mode = MATCH;
              /* falls through */
              case MATCH:
                if (left === 0) {
                  break inf_leave;
                }
                copy = _out - left;
                if (state.offset > copy) {
                  copy = state.offset - copy;
                  if (copy > state.whave) {
                    if (state.sane) {
                      strm.msg = "invalid distance too far back";
                      state.mode = BAD;
                      break;
                    }
                  }
                  if (copy > state.wnext) {
                    copy -= state.wnext;
                    from = state.wsize - copy;
                  } else {
                    from = state.wnext - copy;
                  }
                  if (copy > state.length) {
                    copy = state.length;
                  }
                  from_source = state.window;
                } else {
                  from_source = output2;
                  from = put - state.offset;
                  copy = state.length;
                }
                if (copy > left) {
                  copy = left;
                }
                left -= copy;
                state.length -= copy;
                do {
                  output2[put++] = from_source[from++];
                } while (--copy);
                if (state.length === 0) {
                  state.mode = LEN;
                }
                break;
              case LIT:
                if (left === 0) {
                  break inf_leave;
                }
                output2[put++] = state.length;
                left--;
                state.mode = LEN;
                break;
              case CHECK:
                if (state.wrap) {
                  while (bits < 32) {
                    if (have === 0) {
                      break inf_leave;
                    }
                    have--;
                    hold |= input[next++] << bits;
                    bits += 8;
                  }
                  _out -= left;
                  strm.total_out += _out;
                  state.total += _out;
                  if (_out) {
                    strm.adler = state.check = /*UPDATE(state.check, put - _out, _out);*/
                    state.flags ? crc322(state.check, output2, _out, put - _out) : adler32(state.check, output2, _out, put - _out);
                  }
                  _out = left;
                  if ((state.flags ? hold : zswap32(hold)) !== state.check) {
                    strm.msg = "incorrect data check";
                    state.mode = BAD;
                    break;
                  }
                  hold = 0;
                  bits = 0;
                }
                state.mode = LENGTH;
              /* falls through */
              case LENGTH:
                if (state.wrap && state.flags) {
                  while (bits < 32) {
                    if (have === 0) {
                      break inf_leave;
                    }
                    have--;
                    hold += input[next++] << bits;
                    bits += 8;
                  }
                  if (hold !== (state.total & 4294967295)) {
                    strm.msg = "incorrect length check";
                    state.mode = BAD;
                    break;
                  }
                  hold = 0;
                  bits = 0;
                }
                state.mode = DONE;
              /* falls through */
              case DONE:
                ret = Z_STREAM_END;
                break inf_leave;
              case BAD:
                ret = Z_DATA_ERROR;
                break inf_leave;
              case MEM:
                return Z_MEM_ERROR;
              case SYNC:
              /* falls through */
              default:
                return Z_STREAM_ERROR;
            }
          }
        strm.next_out = put;
        strm.avail_out = left;
        strm.next_in = next;
        strm.avail_in = have;
        state.hold = hold;
        state.bits = bits;
        if (state.wsize || _out !== strm.avail_out && state.mode < BAD && (state.mode < CHECK || flush !== Z_FINISH)) {
          if (updatewindow(strm, strm.output, strm.next_out, _out - strm.avail_out)) {
            state.mode = MEM;
            return Z_MEM_ERROR;
          }
        }
        _in -= strm.avail_in;
        _out -= strm.avail_out;
        strm.total_in += _in;
        strm.total_out += _out;
        state.total += _out;
        if (state.wrap && _out) {
          strm.adler = state.check = /*UPDATE(state.check, strm.next_out - _out, _out);*/
          state.flags ? crc322(state.check, output2, _out, strm.next_out - _out) : adler32(state.check, output2, _out, strm.next_out - _out);
        }
        strm.data_type = state.bits + (state.last ? 64 : 0) + (state.mode === TYPE ? 128 : 0) + (state.mode === LEN_ || state.mode === COPY_ ? 256 : 0);
        if ((_in === 0 && _out === 0 || flush === Z_FINISH) && ret === Z_OK) {
          ret = Z_BUF_ERROR;
        }
        return ret;
      }
      function inflateEnd(strm) {
        if (!strm || !strm.state) {
          return Z_STREAM_ERROR;
        }
        var state = strm.state;
        if (state.window) {
          state.window = null;
        }
        strm.state = null;
        return Z_OK;
      }
      function inflateGetHeader(strm, head) {
        var state;
        if (!strm || !strm.state) {
          return Z_STREAM_ERROR;
        }
        state = strm.state;
        if ((state.wrap & 2) === 0) {
          return Z_STREAM_ERROR;
        }
        state.head = head;
        head.done = false;
        return Z_OK;
      }
      function inflateSetDictionary(strm, dictionary) {
        var dictLength = dictionary.length;
        var state;
        var dictid;
        var ret;
        if (!strm || !strm.state) {
          return Z_STREAM_ERROR;
        }
        state = strm.state;
        if (state.wrap !== 0 && state.mode !== DICT) {
          return Z_STREAM_ERROR;
        }
        if (state.mode === DICT) {
          dictid = 1;
          dictid = adler32(dictid, dictionary, dictLength, 0);
          if (dictid !== state.check) {
            return Z_DATA_ERROR;
          }
        }
        ret = updatewindow(strm, dictionary, dictLength, dictLength);
        if (ret) {
          state.mode = MEM;
          return Z_MEM_ERROR;
        }
        state.havedict = 1;
        return Z_OK;
      }
      exports.inflateReset = inflateReset;
      exports.inflateReset2 = inflateReset2;
      exports.inflateResetKeep = inflateResetKeep;
      exports.inflateInit = inflateInit;
      exports.inflateInit2 = inflateInit2;
      exports.inflate = inflate;
      exports.inflateEnd = inflateEnd;
      exports.inflateGetHeader = inflateGetHeader;
      exports.inflateSetDictionary = inflateSetDictionary;
      exports.inflateInfo = "pako inflate (from Nodeca project)";
    }
  });

  // node_modules/pako/lib/zlib/constants.js
  var require_constants = __commonJS({
    "node_modules/pako/lib/zlib/constants.js"(exports, module) {
      "use strict";
      module.exports = {
        /* Allowed flush values; see deflate() and inflate() below for details */
        Z_NO_FLUSH: 0,
        Z_PARTIAL_FLUSH: 1,
        Z_SYNC_FLUSH: 2,
        Z_FULL_FLUSH: 3,
        Z_FINISH: 4,
        Z_BLOCK: 5,
        Z_TREES: 6,
        /* Return codes for the compression/decompression functions. Negative values
        * are errors, positive values are used for special but normal events.
        */
        Z_OK: 0,
        Z_STREAM_END: 1,
        Z_NEED_DICT: 2,
        Z_ERRNO: -1,
        Z_STREAM_ERROR: -2,
        Z_DATA_ERROR: -3,
        //Z_MEM_ERROR:     -4,
        Z_BUF_ERROR: -5,
        //Z_VERSION_ERROR: -6,
        /* compression levels */
        Z_NO_COMPRESSION: 0,
        Z_BEST_SPEED: 1,
        Z_BEST_COMPRESSION: 9,
        Z_DEFAULT_COMPRESSION: -1,
        Z_FILTERED: 1,
        Z_HUFFMAN_ONLY: 2,
        Z_RLE: 3,
        Z_FIXED: 4,
        Z_DEFAULT_STRATEGY: 0,
        /* Possible values of the data_type field (though see inflate()) */
        Z_BINARY: 0,
        Z_TEXT: 1,
        //Z_ASCII:                1, // = Z_TEXT (deprecated)
        Z_UNKNOWN: 2,
        /* The deflate compression method */
        Z_DEFLATED: 8
        //Z_NULL:                 null // Use -1 or null inline, depending on var type
      };
    }
  });

  // node_modules/pako/lib/zlib/gzheader.js
  var require_gzheader = __commonJS({
    "node_modules/pako/lib/zlib/gzheader.js"(exports, module) {
      "use strict";
      function GZheader() {
        this.text = 0;
        this.time = 0;
        this.xflags = 0;
        this.os = 0;
        this.extra = null;
        this.extra_len = 0;
        this.name = "";
        this.comment = "";
        this.hcrc = 0;
        this.done = false;
      }
      module.exports = GZheader;
    }
  });

  // node_modules/pako/lib/inflate.js
  var require_inflate2 = __commonJS({
    "node_modules/pako/lib/inflate.js"(exports) {
      "use strict";
      var zlib_inflate = require_inflate();
      var utils = require_common();
      var strings = require_strings();
      var c = require_constants();
      var msg = require_messages();
      var ZStream = require_zstream();
      var GZheader = require_gzheader();
      var toString = Object.prototype.toString;
      function Inflate(options) {
        if (!(this instanceof Inflate)) return new Inflate(options);
        this.options = utils.assign({
          chunkSize: 16384,
          windowBits: 0,
          to: ""
        }, options || {});
        var opt = this.options;
        if (opt.raw && opt.windowBits >= 0 && opt.windowBits < 16) {
          opt.windowBits = -opt.windowBits;
          if (opt.windowBits === 0) {
            opt.windowBits = -15;
          }
        }
        if (opt.windowBits >= 0 && opt.windowBits < 16 && !(options && options.windowBits)) {
          opt.windowBits += 32;
        }
        if (opt.windowBits > 15 && opt.windowBits < 48) {
          if ((opt.windowBits & 15) === 0) {
            opt.windowBits |= 15;
          }
        }
        this.err = 0;
        this.msg = "";
        this.ended = false;
        this.chunks = [];
        this.strm = new ZStream();
        this.strm.avail_out = 0;
        var status2 = zlib_inflate.inflateInit2(
          this.strm,
          opt.windowBits
        );
        if (status2 !== c.Z_OK) {
          throw new Error(msg[status2]);
        }
        this.header = new GZheader();
        zlib_inflate.inflateGetHeader(this.strm, this.header);
        if (opt.dictionary) {
          if (typeof opt.dictionary === "string") {
            opt.dictionary = strings.string2buf(opt.dictionary);
          } else if (toString.call(opt.dictionary) === "[object ArrayBuffer]") {
            opt.dictionary = new Uint8Array(opt.dictionary);
          }
          if (opt.raw) {
            status2 = zlib_inflate.inflateSetDictionary(this.strm, opt.dictionary);
            if (status2 !== c.Z_OK) {
              throw new Error(msg[status2]);
            }
          }
        }
      }
      Inflate.prototype.push = function(data, mode) {
        var strm = this.strm;
        var chunkSize = this.options.chunkSize;
        var dictionary = this.options.dictionary;
        var status2, _mode;
        var next_out_utf8, tail, utf8str;
        var allowBufError = false;
        if (this.ended) {
          return false;
        }
        _mode = mode === ~~mode ? mode : mode === true ? c.Z_FINISH : c.Z_NO_FLUSH;
        if (typeof data === "string") {
          strm.input = strings.binstring2buf(data);
        } else if (toString.call(data) === "[object ArrayBuffer]") {
          strm.input = new Uint8Array(data);
        } else {
          strm.input = data;
        }
        strm.next_in = 0;
        strm.avail_in = strm.input.length;
        do {
          if (strm.avail_out === 0) {
            strm.output = new utils.Buf8(chunkSize);
            strm.next_out = 0;
            strm.avail_out = chunkSize;
          }
          status2 = zlib_inflate.inflate(strm, c.Z_NO_FLUSH);
          if (status2 === c.Z_NEED_DICT && dictionary) {
            status2 = zlib_inflate.inflateSetDictionary(this.strm, dictionary);
          }
          if (status2 === c.Z_BUF_ERROR && allowBufError === true) {
            status2 = c.Z_OK;
            allowBufError = false;
          }
          if (status2 !== c.Z_STREAM_END && status2 !== c.Z_OK) {
            this.onEnd(status2);
            this.ended = true;
            return false;
          }
          if (strm.next_out) {
            if (strm.avail_out === 0 || status2 === c.Z_STREAM_END || strm.avail_in === 0 && (_mode === c.Z_FINISH || _mode === c.Z_SYNC_FLUSH)) {
              if (this.options.to === "string") {
                next_out_utf8 = strings.utf8border(strm.output, strm.next_out);
                tail = strm.next_out - next_out_utf8;
                utf8str = strings.buf2string(strm.output, next_out_utf8);
                strm.next_out = tail;
                strm.avail_out = chunkSize - tail;
                if (tail) {
                  utils.arraySet(strm.output, strm.output, next_out_utf8, tail, 0);
                }
                this.onData(utf8str);
              } else {
                this.onData(utils.shrinkBuf(strm.output, strm.next_out));
              }
            }
          }
          if (strm.avail_in === 0 && strm.avail_out === 0) {
            allowBufError = true;
          }
        } while ((strm.avail_in > 0 || strm.avail_out === 0) && status2 !== c.Z_STREAM_END);
        if (status2 === c.Z_STREAM_END) {
          _mode = c.Z_FINISH;
        }
        if (_mode === c.Z_FINISH) {
          status2 = zlib_inflate.inflateEnd(this.strm);
          this.onEnd(status2);
          this.ended = true;
          return status2 === c.Z_OK;
        }
        if (_mode === c.Z_SYNC_FLUSH) {
          this.onEnd(c.Z_OK);
          strm.avail_out = 0;
          return true;
        }
        return true;
      };
      Inflate.prototype.onData = function(chunk) {
        this.chunks.push(chunk);
      };
      Inflate.prototype.onEnd = function(status2) {
        if (status2 === c.Z_OK) {
          if (this.options.to === "string") {
            this.result = this.chunks.join("");
          } else {
            this.result = utils.flattenChunks(this.chunks);
          }
        }
        this.chunks = [];
        this.err = status2;
        this.msg = this.strm.msg;
      };
      function inflate(input, options) {
        var inflator = new Inflate(options);
        inflator.push(input, true);
        if (inflator.err) {
          throw inflator.msg || msg[inflator.err];
        }
        return inflator.result;
      }
      function inflateRaw(input, options) {
        options = options || {};
        options.raw = true;
        return inflate(input, options);
      }
      exports.Inflate = Inflate;
      exports.inflate = inflate;
      exports.inflateRaw = inflateRaw;
      exports.ungzip = inflate;
    }
  });

  // node_modules/pako/index.js
  var require_pako = __commonJS({
    "node_modules/pako/index.js"(exports, module) {
      "use strict";
      var assign = require_common().assign;
      var deflate = require_deflate2();
      var inflate = require_inflate2();
      var constants = require_constants();
      var pako2 = {};
      assign(pako2, deflate, inflate, constants);
      module.exports = pako2;
    }
  });

  // packages/web-ide/src/workspace-paths.js
  var WORKSPACE_ROOT = "/workspace";
  var MAIN_FILE = WORKSPACE_ROOT + "/main.idyl";
  function itemName(path) {
    return normalizeWorkspacePath(path).split("/").pop() || "";
  }
  function studentPath(path) {
    const normalized = normalizeWorkspacePath(path);
    if (normalized === WORKSPACE_ROOT) return "";
    return normalized.startsWith(WORKSPACE_ROOT + "/") ? normalized.slice(WORKSPACE_ROOT.length + 1) : normalized;
  }
  function normalizeWorkspacePath(path) {
    const input = String(path).replace(/\\/g, "/");
    const raw = input === WORKSPACE_ROOT ? "" : input.startsWith(WORKSPACE_ROOT + "/") ? input.slice((WORKSPACE_ROOT + "/").length) : input.replace(/^\/+/, "");
    const parts = raw.split("/");
    const normalized = [];
    for (const part of parts) {
      if (!part || part === ".") continue;
      if (part === "..") {
        normalized.pop();
        continue;
      }
      normalized.push(part);
    }
    return normalized.length === 0 ? WORKSPACE_ROOT : WORKSPACE_ROOT + "/" + normalized.join("/");
  }
  function shortFileName(file) {
    const path = normalizeWorkspacePath(file);
    return path === WORKSPACE_ROOT ? "" : path.slice((WORKSPACE_ROOT + "/").length);
  }
  function basename(path) {
    const short = shortFileName(path);
    const parts = short.split("/").filter(Boolean);
    return parts[parts.length - 1] || "workspace";
  }
  function parentPath(path) {
    path = normalizeWorkspacePath(path);
    if (path === WORKSPACE_ROOT) return WORKSPACE_ROOT;
    const short = shortFileName(path);
    const parts = short.split("/").filter(Boolean);
    parts.pop();
    return parts.length === 0 ? WORKSPACE_ROOT : normalizeWorkspacePath(parts.join("/"));
  }
  function formatThrownError(error) {
    const text = error instanceof Error ? error.message : String(error);
    return formatDiagnosticText(text);
  }
  function formatDiagnosticText(text) {
    return String(text).replaceAll(WORKSPACE_ROOT + "/", "").replace(/(^|\n)([^:\n]+):(\d+):\d+:(?=\s)/gu, "$1$2:$3:");
  }

  // packages/web-ide/src/idyllium-highlight.js
  var KEYWORDS = /* @__PURE__ */ new Set([
    "and",
    "break",
    "catch",
    "class",
    "const",
    "constructor",
    "continue",
    "do",
    "else",
    "event",
    "extends",
    "false",
    "finally",
    "for",
    "function",
    "if",
    "not",
    "or",
    "parent",
    "private",
    "public",
    "return",
    "static",
    "this",
    "true",
    "null",
    "try",
    "use",
    "while",
    "xor"
  ]);
  var BUILTIN_TYPES = /* @__PURE__ */ new Set([
    "array",
    "bool",
    "char",
    "dyn_array",
    "float",
    "int",
    "map",
    "set",
    "string",
    "void"
  ]);
  var CLASS_NAMES = /* @__PURE__ */ new Set([
    "Array",
    "BarChart",
    "Button",
    "Canvas",
    "CheckBox",
    "Circle",
    "Color",
    "ComboBox",
    "Drawable",
    "FloatSpinBox",
    "Font",
    "Frame",
    "Animation",
    "Bitmap",
    "Image",
    "ImageBox",
    "KeyboardEvent",
    "Label",
    "Line",
    "LineChart",
    "LineEdit",
    "Modal",
    "MouseEvent",
    "MouseScrollEvent",
    "Music",
    "Database",
    "Node",
    "Object",
    "PieChart",
    "Post",
    "ProgressBar",
    "RadioButton",
    "Rectangle",
    "Request",
    "Response",
    "Result",
    "Server",
    "Slider",
    "Sound",
    "SpinBox",
    "Sprite",
    "Statement",
    "Static",
    "TabWidget",
    "Table",
    "Text",
    "TextEdit",
    "Timer",
    "Turtle",
    "Value",
    "Vector",
    "Widget",
    "Window"
  ]);
  var QUALIFIED_TYPES = /* @__PURE__ */ new Set([
    ...CLASS_NAMES,
    "float32",
    "float64",
    "int8",
    "int16",
    "int32",
    "int64",
    "istream",
    "ostream",
    "stamp",
    "stream",
    "uint8",
    "uint16",
    "uint32",
    "uint64"
  ]);
  function highlightIdyllium(source) {
    let html = "";
    let index = 0;
    while (index < source.length) {
      const rest = source.slice(index);
      const comment = /^\/\/[^\n]*/u.exec(rest);
      if (comment) {
        html += span("tok-comment", comment[0]);
        index += comment[0].length;
        continue;
      }
      const string = /^(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/u.exec(rest);
      if (string) {
        html += span("tok-string", string[0]);
        index += string[0].length;
        continue;
      }
      const number = /^\b\d+(?:\.\d+)?\b/u.exec(rest);
      if (number) {
        html += span("tok-number", number[0]);
        index += number[0].length;
        continue;
      }
      const member = /^(\.)([A-Za-z_А-Яа-яЁё][A-Za-z0-9_А-Яа-яЁё]*)/u.exec(rest);
      if (member) {
        html += escapeHtml(member[1]) + span("tok-property", member[2]);
        index += member[0].length;
        continue;
      }
      const identifier = /^[A-Za-z_А-Яа-яЁё][A-Za-z0-9_А-Яа-яЁё]*/u.exec(rest);
      if (identifier) {
        const word = identifier[0];
        const afterWord = source.slice(index + word.length);
        const beforeWord = source.slice(0, index);
        const isDeclaredClass = /\b(?:class|extends)\s*$/u.test(beforeWord);
        const isTypePosition = /^[A-ZА-ЯЁ]/u.test(word) && /^\s+[A-Za-z_А-Яа-яЁё][A-Za-z0-9_А-Яа-яЁё]*\s*(?:[=;,)\[]|$)/u.test(afterWord);
        if (KEYWORDS.has(word)) {
          html += span("tok-keyword", word);
        } else if (BUILTIN_TYPES.has(word) || CLASS_NAMES.has(word) || QUALIFIED_TYPES.has(word) || isDeclaredClass || isTypePosition) {
          html += span("tok-type", word);
        } else if (/^\s*\(/u.test(afterWord)) {
          html += span("tok-function", word);
        } else {
          html += escapeHtml(word);
        }
        index += word.length;
        continue;
      }
      html += escapeHtml(source[index]);
      index++;
    }
    return html.endsWith("\n") ? html + " " : html;
  }
  function span(className, text) {
    return '<span class="' + className + '">' + escapeHtml(text) + "</span>";
  }
  function escapeHtml(value) {
    return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  }

  // packages/web-ide/src/zip.js
  var import_pako = __toESM(require_pako());
  var CRC32_TABLE = buildCrc32Table();
  function zipBytes(entries) {
    const chunks = [];
    const central = [];
    let offset = 0;
    for (const entry of entries) {
      const nameBytes = new TextEncoder().encode(entry.name);
      const data = entry.bytes;
      const crc = crc32(data);
      const localHeader = zipHeader(30);
      localHeader.setUint32(0, 67324752, true);
      localHeader.setUint16(4, 20, true);
      localHeader.setUint16(6, 2048, true);
      localHeader.setUint16(8, 0, true);
      localHeader.setUint16(10, dosTime().time, true);
      localHeader.setUint16(12, dosTime().date, true);
      localHeader.setUint32(14, crc, true);
      localHeader.setUint32(18, data.length, true);
      localHeader.setUint32(22, data.length, true);
      localHeader.setUint16(26, nameBytes.length, true);
      localHeader.setUint16(28, 0, true);
      chunks.push(new Uint8Array(localHeader.buffer), nameBytes, data);
      const centralHeader = zipHeader(46);
      centralHeader.setUint32(0, 33639248, true);
      centralHeader.setUint16(4, 20, true);
      centralHeader.setUint16(6, 20, true);
      centralHeader.setUint16(8, 2048, true);
      centralHeader.setUint16(10, 0, true);
      centralHeader.setUint16(12, dosTime().time, true);
      centralHeader.setUint16(14, dosTime().date, true);
      centralHeader.setUint32(16, crc, true);
      centralHeader.setUint32(20, data.length, true);
      centralHeader.setUint32(24, data.length, true);
      centralHeader.setUint16(28, nameBytes.length, true);
      centralHeader.setUint16(30, 0, true);
      centralHeader.setUint16(32, 0, true);
      centralHeader.setUint16(34, 0, true);
      centralHeader.setUint16(36, 0, true);
      centralHeader.setUint32(38, 0, true);
      centralHeader.setUint32(42, offset, true);
      central.push(new Uint8Array(centralHeader.buffer), nameBytes);
      offset += localHeader.byteLength + nameBytes.length + data.length;
    }
    const centralOffset = offset;
    const centralSize = central.reduce((sum, chunk) => sum + chunk.length, 0);
    const end = zipHeader(22);
    end.setUint32(0, 101010256, true);
    end.setUint16(4, 0, true);
    end.setUint16(6, 0, true);
    end.setUint16(8, entries.length, true);
    end.setUint16(10, entries.length, true);
    end.setUint32(12, centralSize, true);
    end.setUint32(16, centralOffset, true);
    end.setUint16(20, 0, true);
    return concatBytes([...chunks, ...central, new Uint8Array(end.buffer)]);
  }
  function unzipEntries(bytes) {
    const entries = [];
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let offset = 0;
    while (offset + 4 <= bytes.length) {
      const signature = view.getUint32(offset, true);
      if (signature === 33639248 || signature === 101010256) break;
      if (signature !== 67324752) throw new Error("ZIP-архив имеет неподдерживаемый формат");
      if (offset + 30 > bytes.length) throw new Error("ZIP-архив повреждён");
      const flags = view.getUint16(offset + 6, true);
      const method = view.getUint16(offset + 8, true);
      const expectedCrc = view.getUint32(offset + 14, true);
      const compressedSize = view.getUint32(offset + 18, true);
      const uncompressedSize = view.getUint32(offset + 22, true);
      const nameLength = view.getUint16(offset + 26, true);
      const extraLength = view.getUint16(offset + 28, true);
      const nameStart = offset + 30;
      const dataStart = nameStart + nameLength + extraLength;
      const dataEnd = dataStart + compressedSize;
      if ((flags & 8) !== 0 && compressedSize === 0 && uncompressedSize !== 0) {
        throw new Error("этот ZIP записан потоком (data descriptor) — пересохраните его обычным архиватором");
      }
      if (method !== 0 && method !== 8) {
        throw new Error(`способ сжатия ${method} в ZIP не поддерживается (понимаем обычный deflate и без сжатия)`);
      }
      if (dataEnd > bytes.length) throw new Error("ZIP-архив повреждён");
      const name = new TextDecoder("utf-8").decode(bytes.slice(nameStart, nameStart + nameLength));
      const raw = bytes.slice(dataStart, dataEnd);
      let data = raw;
      if (method === 8) {
        try {
          data = import_pako.default.inflateRaw(raw);
        } catch (error) {
          throw new Error(`Файл ${name} в ZIP не распаковался: ${error && error.message ? error.message : error}`);
        }
      }
      if (data.length !== uncompressedSize) throw new Error(`Файл ${name} в ZIP имеет неверный размер`);
      if (crc32(data) !== expectedCrc) throw new Error(`Файл ${name} в ZIP повреждён`);
      entries.push({ name, bytes: data, directory: name.endsWith("/") });
      offset = dataEnd;
    }
    return entries;
  }
  function zipHeader(size) {
    return new DataView(new ArrayBuffer(size));
  }
  function dosTime() {
    const now = /* @__PURE__ */ new Date();
    return {
      time: now.getHours() << 11 | now.getMinutes() << 5 | Math.floor(now.getSeconds() / 2),
      date: now.getFullYear() - 1980 << 9 | now.getMonth() + 1 << 5 | now.getDate()
    };
  }
  function concatBytes(chunks) {
    const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const result = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }
    return result;
  }
  function crc32(bytes) {
    let crc = 4294967295;
    for (const byte of bytes) {
      crc = CRC32_TABLE[(crc ^ byte) & 255] ^ crc >>> 8;
    }
    return (crc ^ 4294967295) >>> 0;
  }
  function buildCrc32Table() {
    const table = new Uint32Array(256);
    for (let index = 0; index < table.length; index++) {
      let value = index;
      for (let bit = 0; bit < 8; bit++) {
        value = value & 1 ? 3988292384 ^ value >>> 1 : value >>> 1;
      }
      table[index] = value >>> 0;
    }
    return table;
  }

  // packages/web-ide/src/ansi.js
  var ANSI_FOREGROUND_CLASSES = /* @__PURE__ */ new Map([
    [30, "ansi-fg-black"],
    [31, "ansi-fg-red"],
    [32, "ansi-fg-green"],
    [33, "ansi-fg-yellow"],
    [34, "ansi-fg-blue"],
    [35, "ansi-fg-magenta"],
    [36, "ansi-fg-cyan"],
    [37, "ansi-fg-white"],
    [90, "ansi-fg-bright-black"],
    [91, "ansi-fg-bright-red"],
    [92, "ansi-fg-bright-green"],
    [93, "ansi-fg-bright-yellow"],
    [94, "ansi-fg-bright-blue"],
    [95, "ansi-fg-bright-magenta"],
    [96, "ansi-fg-bright-cyan"],
    [97, "ansi-fg-bright-white"]
  ]);
  function appendAnsiText(parent, text) {
    for (const node of ansiTextNodes(String(text))) {
      parent.appendChild(node);
    }
  }
  function ansiTextNodes(text) {
    let foregroundClass = "";
    let bold = false;
    let buffer = "";
    const nodes = [];
    const flush = () => {
      if (!buffer) return;
      if (!foregroundClass && !bold) {
        nodes.push(document.createTextNode(buffer));
      } else {
        const span2 = document.createElement("span");
        span2.className = [foregroundClass, bold ? "ansi-bold" : ""].filter(Boolean).join(" ");
        span2.textContent = buffer;
        nodes.push(span2);
      }
      buffer = "";
    };
    for (let index = 0; index < text.length; ) {
      if (text.charCodeAt(index) !== 27 || text[index + 1] !== "[") {
        buffer += text[index];
        index += 1;
        continue;
      }
      const end = findAnsiEnd(text, index + 2);
      if (end === -1) {
        index += 1;
        continue;
      }
      flush();
      const command = text[end];
      const rawParams = text.slice(index + 2, end);
      const params = rawParams.length === 0 ? [0] : rawParams.split(";").map((part) => Number(part || 0));
      if (command === "m") {
        for (const param of params) {
          if (param === 0) {
            foregroundClass = "";
            bold = false;
          } else if (param === 1) {
            bold = true;
          } else if (param === 22) {
            bold = false;
          } else if (param === 39) {
            foregroundClass = "";
          } else if (ANSI_FOREGROUND_CLASSES.has(param)) {
            foregroundClass = ANSI_FOREGROUND_CLASSES.get(param);
          }
        }
      } else if (command === "J" && params.some((param) => param === 2 || param === 3)) {
        nodes.length = 0;
        buffer = "";
      }
      index = end + 1;
    }
    flush();
    return nodes;
  }
  function findAnsiEnd(text, start) {
    for (let index = start; index < text.length; index += 1) {
      const code = text.charCodeAt(index);
      if (code >= 64 && code <= 126) return index;
    }
    return -1;
  }

  // packages/web-ide/src/binary-format.js
  function bytesToDataUrl(fileName, bytes) {
    return bytesToDataUrlWithMime(mimeTypeForFile(fileName), bytes);
  }
  function bytesToDataUrlWithMime(mime, bytes) {
    let binary = "";
    const chunkSize = 32768;
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
      const chunk = bytes.slice(offset, offset + chunkSize);
      binary += String.fromCharCode(...chunk);
    }
    return `data:${mime};base64,${btoa(binary)}`;
  }
  function mimeTypeForFile(fileName) {
    const name = fileName.toLowerCase();
    if (name.endsWith(".idyl")) return "text/x-idyllium";
    if (name.endsWith(".txt")) return "text/plain";
    if (name.endsWith(".csv")) return "text/csv";
    if (name.endsWith(".json")) return "application/json";
    if (name.endsWith(".md") || name.endsWith(".markdown")) return "text/markdown";
    if (name.endsWith(".xml")) return "application/xml";
    if (name.endsWith(".html") || name.endsWith(".htm")) return "text/html";
    if (name.endsWith(".css")) return "text/css";
    if (name.endsWith(".png")) return "image/png";
    if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
    if (name.endsWith(".gif")) return "image/gif";
    if (name.endsWith(".webp")) return "image/webp";
    if (name.endsWith(".svg")) return "image/svg+xml";
    if (name.endsWith(".ttf")) return "font/ttf";
    if (name.endsWith(".otf")) return "font/otf";
    if (name.endsWith(".woff")) return "font/woff";
    if (name.endsWith(".woff2")) return "font/woff2";
    if (name.endsWith(".mp3")) return "audio/mpeg";
    if (name.endsWith(".wav")) return "audio/wav";
    if (name.endsWith(".ogg")) return "audio/ogg";
    if (name.endsWith(".aac")) return "audio/aac";
    if (name.endsWith(".m4a")) return "audio/mp4";
    if (isSqliteFile(name)) return "application/vnd.sqlite3";
    return "application/octet-stream";
  }
  function detectAssetMimeType(fileName, bytes) {
    if (!(bytes instanceof Uint8Array) || bytes.length === 0) return mimeTypeForFile(fileName);
    if (asciiBytes(bytes, 0, 16) === "SQLite format 3\0") return "application/vnd.sqlite3";
    if (hasBytes(bytes, [137, 80, 78, 71, 13, 10, 26, 10], 0)) return "image/png";
    if (hasBytes(bytes, [255, 216, 255], 0)) return "image/jpeg";
    const header6 = asciiBytes(bytes, 0, 6);
    if (header6 === "GIF87a" || header6 === "GIF89a") return "image/gif";
    if (asciiBytes(bytes, 0, 4) === "RIFF" && asciiBytes(bytes, 8, 4) === "WEBP") return "image/webp";
    if (asciiBytes(bytes, 0, 4) === "RIFF" && asciiBytes(bytes, 8, 4) === "WAVE") return "audio/wav";
    if (hasBytes(bytes, [73, 68, 51], 0) || mp3FrameHeader(bytes)) return "audio/mpeg";
    if (asciiBytes(bytes, 0, 4) === "OggS") return "audio/ogg";
    if (aacHeader(bytes)) return "audio/aac";
    if (asciiBytes(bytes, 4, 4) === "ftyp") return "audio/mp4";
    if (hasBytes(bytes, [0, 1, 0, 0], 0) || asciiBytes(bytes, 0, 4) === "true") return "font/ttf";
    if (asciiBytes(bytes, 0, 4) === "OTTO") return "font/otf";
    if (asciiBytes(bytes, 0, 4) === "wOFF") return "font/woff";
    if (asciiBytes(bytes, 0, 4) === "wOF2") return "font/woff2";
    if (looksLikeSvg(bytes)) return "image/svg+xml";
    return mimeTypeForFile(fileName);
  }
  function isSqliteFile(fileName) {
    return /\.(?:db|db3|sqlite|sqlite3)$/iu.test(fileName);
  }
  function fontFormatName(mime) {
    if (mime === "font/ttf") return "TTF";
    if (mime === "font/otf") return "OTF";
    if (mime === "font/woff") return "WOFF";
    if (mime === "font/woff2") return "WOFF2";
    return "неизвестно";
  }
  function mp3FrameHeader(bytes) {
    return bytes.length >= 2 && bytes[0] === 255 && (bytes[1] & 224) === 224;
  }
  function aacHeader(bytes) {
    return bytes.length >= 2 && bytes[0] === 255 && (bytes[1] & 246) === 240;
  }
  function imageAlphaInfo(mime, bytes) {
    if (mime === "image/jpeg") return "нет";
    if (mime === "image/svg+xml") return "возможно";
    if (mime === "image/png") return pngAlphaInfo(bytes);
    if (mime === "image/gif") return gifAlphaInfo(bytes);
    if (mime === "image/webp") return webpAlphaInfo(bytes);
    if (mime.startsWith("image/")) return "неизвестно";
    return "нет";
  }
  function pngAlphaInfo(bytes) {
    if (!(bytes instanceof Uint8Array) || bytes.length < 33 || !hasBytes(bytes, [137, 80, 78, 71, 13, 10, 26, 10], 0)) {
      return "неизвестно";
    }
    const colorType = bytes[25];
    if (colorType === 4 || colorType === 6) return "есть";
    return pngHasTransparencyChunk(bytes) ? "есть" : "нет";
  }
  function pngHasTransparencyChunk(bytes) {
    let offset = 8;
    while (offset + 12 <= bytes.length) {
      const length = readUint32(bytes, offset);
      const type = asciiBytes(bytes, offset + 4, 4);
      if (type === "tRNS") return true;
      if (type === "IEND") return false;
      offset += 12 + length;
    }
    return false;
  }
  function gifAlphaInfo(bytes) {
    for (let index = 0; index + 5 < bytes.length; index++) {
      if (bytes[index] === 33 && bytes[index + 1] === 249 && bytes[index + 2] === 4) {
        if ((bytes[index + 3] & 1) === 1) return "есть";
      }
    }
    return "нет";
  }
  function webpAlphaInfo(bytes) {
    if (asciiBytes(bytes, 0, 4) !== "RIFF" || asciiBytes(bytes, 8, 4) !== "WEBP") return "неизвестно";
    if (asciiBytes(bytes, 12, 4) === "VP8X" && bytes.length > 20) {
      return (bytes[20] & 16) === 16 ? "есть" : "нет";
    }
    return "неизвестно";
  }
  function looksLikeSvg(bytes) {
    const sample = new TextDecoder().decode(bytes.slice(0, Math.min(bytes.length, 512))).trimStart().toLowerCase();
    return sample.startsWith("<svg") || sample.startsWith("<?xml") && sample.includes("<svg");
  }
  function hasBytes(bytes, expected, offset) {
    if (bytes.length < offset + expected.length) return false;
    return expected.every((byte, index) => bytes[offset + index] === byte);
  }
  function asciiBytes(bytes, offset, length) {
    if (bytes.length < offset + length) return "";
    let text = "";
    for (let index = 0; index < length; index++) text += String.fromCharCode(bytes[offset + index]);
    return text;
  }
  function readUint32(bytes, offset) {
    if (bytes.length < offset + 4) return 0;
    return (bytes[offset] << 24 | bytes[offset + 1] << 16 | bytes[offset + 2] << 8 | bytes[offset + 3]) >>> 0;
  }
  function formatBytes(size) {
    if (!Number.isFinite(size) || size < 0) return "неизвестно";
    if (size < 1024) return `${size} Б`;
    if (size < 1024 * 1024) return `${trimFileSize(size / 1024)} КБ`;
    return `${trimFileSize(size / (1024 * 1024))} МБ`;
  }
  function trimFileSize(value) {
    return value >= 10 ? value.toFixed(1) : value.toFixed(2);
  }
  function formatDuration(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return "неизвестно";
    const rounded = Math.round(seconds);
    const minutes = Math.floor(rounded / 60);
    const rest = rounded % 60;
    return `${minutes}:${String(rest).padStart(2, "0")}`;
  }
  function dataUrlBytes(value) {
    const comma = value.indexOf(",");
    if (comma < 0) return new Uint8Array();
    const meta = value.slice(0, comma);
    const data = value.slice(comma + 1);
    if (meta.includes(";base64")) {
      const binary = atob(data);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
      return bytes;
    }
    return new TextEncoder().encode(decodeURIComponent(data));
  }
  function assetBytes(item) {
    if (item.bytes instanceof Uint8Array) return item.bytes;
    if (item.resourceUri && item.resourceUri.startsWith("data:")) return dataUrlBytes(item.resourceUri);
    return new TextEncoder().encode(item.content || "");
  }

  // packages/web-ide/src/project-store.js
  var files = /* @__PURE__ */ new Map([
    [MAIN_FILE, {
      kind: "text",
      content: [
        "use console;",
        "",
        "main() {",
        `    console.write("Hello, World!", '\\n');`,
        "}"
      ].join("\n")
    }]
  ]);

  // packages/web-ide/src/num-util.js
  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  // packages/web-ide/src/viewer-host.js
  var viewerHost = {
    openFile: (_file) => {
    },
    currentFile: () => ""
  };
  function registerViewerHost(host) {
    viewerHost.openFile = host.openFile;
    viewerHost.currentFile = host.currentFile;
  }

  // packages/web-ide/src/dom.js
  var monacoHost = document.getElementById("monaco-editor");
  var assetViewer = document.getElementById("asset-viewer");
  var csvViewer = document.getElementById("csv-viewer");
  var jsonViewer = document.getElementById("json-viewer");
  var markdownViewer = document.getElementById("markdown-viewer");
  var legacyEditor = document.getElementById("legacy-editor");
  var editor = document.getElementById("editor");
  var highlight = document.querySelector("#highlight code");
  var lineNumbers = document.getElementById("line-numbers");
  var completionPopup = document.getElementById("completion-popup");
  var editorTitle = document.getElementById("editor-title");
  var fileList = document.getElementById("file-list");
  var output = document.getElementById("output");
  var consoleInputPanel = document.getElementById("console-input-panel");
  var consoleInput = document.getElementById("console-input");
  var consoleInputSubmit = document.getElementById("console-input-submit");
  var status = document.getElementById("status");
  var guiFrame = document.getElementById("gui-frame");
  var workspace = document.querySelector(".workspace");
  var runtimePane = document.querySelector(".runtime-pane");
  var runtimeRowResizer = document.getElementById("runtime-row-resizer");
  var runButton = document.getElementById("run-button");
  var stopButton = document.getElementById("stop-button");
  var formatButton = document.getElementById("format-button");
  var structuredViewToggle = document.getElementById("structured-view-toggle");
  var structuredTextViewButton = document.getElementById("structured-text-view-button");
  var structuredDataViewButton = document.getElementById("structured-data-view-button");
  var newFileButton = document.getElementById("new-file-button");
  var newFolderButton = document.getElementById("new-folder-button");
  var fileContextMenu = document.getElementById("file-context-menu");
  var filePropsModal = document.getElementById("file-props-modal");
  var uploadButton = document.getElementById("upload-button");
  var uploadMenu = document.getElementById("upload-menu");
  var dropArea = document.getElementById("drop-area");
  var uploadInput = document.getElementById("upload-input");
  var uploadConflict = document.getElementById("upload-conflict");
  var uploadConflictName = document.getElementById("upload-conflict-name");
  var uploadConflictSkip = document.getElementById("upload-conflict-skip");
  var uploadConflictReplace = document.getElementById("upload-conflict-replace");
  var themeButton = document.getElementById("theme-button");
  var themeMenu = document.getElementById("theme-menu");
  var themeDarkButton = document.getElementById("theme-dark-button");
  var themeLightButton = document.getElementById("theme-light-button");
  var fontSizeDecrease = document.getElementById("font-size-decrease");
  var fontSizeIncrease = document.getElementById("font-size-increase");
  var fontSizeInput = document.getElementById("font-size-input");
  var consoleFontSizeDecrease = document.getElementById("console-font-size-decrease");
  var consoleFontSizeIncrease = document.getElementById("console-font-size-increase");
  var consoleFontSizeInput = document.getElementById("console-font-size-input");
  var colorPickerButton = document.getElementById("color-picker-button");
  var colorPickerMenu = document.getElementById("color-picker-menu");
  var fileAppMenuWrapper = document.getElementById("file-app-menu-wrapper");
  var fileAppMenuButton = document.getElementById("file-app-menu-button");
  var fileAppMenu = document.getElementById("file-app-menu");
  var fileAppMenuMain = document.getElementById("file-app-menu-main");
  var fileAppMenuPanel = document.getElementById("file-app-menu-panel");
  var currentProjectNameElement = document.getElementById("current-project-name");
  var editAppMenuWrapper = document.getElementById("edit-app-menu-wrapper");
  var editAppMenuButton = document.getElementById("edit-app-menu-button");
  var editAppMenu = document.getElementById("edit-app-menu");
  var colorPreview = document.getElementById("color-preview");
  var colorRgbCode = document.getElementById("color-rgb-code");
  var colorHexCode = document.getElementById("color-hex-code");
  var colorSliders = {
    red: document.getElementById("color-red-slider"),
    green: document.getElementById("color-green-slider"),
    blue: document.getElementById("color-blue-slider"),
    alpha: document.getElementById("color-alpha-slider")
  };
  var colorInputs = {
    red: document.getElementById("color-red-input"),
    green: document.getElementById("color-green-input"),
    blue: document.getElementById("color-blue-input"),
    alpha: document.getElementById("color-alpha-input")
  };
  function createIcon(name) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    if (name === "menu") {
      for (const y of [6, 12, 18]) {
        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        circle.setAttribute("cx", "12");
        circle.setAttribute("cy", String(y));
        circle.setAttribute("r", "1.5");
        circle.setAttribute("fill", "currentColor");
        svg.appendChild(circle);
      }
      return svg;
    }
    const paths = {
      file: ["M6 3h8l4 4v14H6z", "M14 3v5h5"],
      asset: ["M5 4h14v16H5z", "M8 15l3-3 2 2 2-3 3 4", "M9 8h.01"],
      database: ["M4 5c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3Z", "M4 5v7c0 1.7 3.6 3 8 3s8-1.3 8-3V5", "M4 12v7c0 1.7 3.6 3 8 3s8-1.3 8-3v-7"],
      folder: ["M3 6h7l2 2h9v11H3z"],
      "folder-open": ["M3 7h7l2 2h9l-2 10H3z", "M3 7v12"],
      "zoom-in": ["M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z", "m21 21-4.35-4.35", "M11 8v6", "M8 11h6"],
      "zoom-out": ["M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z", "m21 21-4.35-4.35", "M8 11h6"],
      fit: ["M3 7V5a2 2 0 0 1 2-2h2", "M17 3h2a2 2 0 0 1 2 2v2", "M21 17v2a2 2 0 0 1-2 2h-2", "M7 21H5a2 2 0 0 1-2-2v-2"]
    };
    for (const d of paths[name] || paths.file) {
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", d);
      svg.appendChild(path);
    }
    return svg;
  }

  // packages/web-ide/src/viewer-structured.js
  var CSV_ROW_RENDER_LIMIT = 500;
  var CSV_COLUMN_RENDER_LIMIT = 100;
  var JSON_NODE_RENDER_LIMIT = 5e3;
  var JSON_DEPTH_RENDER_LIMIT = 64;
  var csvHeaderModes = /* @__PURE__ */ new Map();
  function renderCsvTable(file, source) {
    if (!csvViewer) return;
    if (!window.Papa || typeof window.Papa.parse !== "function") {
      const unavailable = document.createElement("div");
      unavailable.className = "csv-empty";
      unavailable.textContent = "Не удалось загрузить модуль просмотра CSV";
      csvViewer.appendChild(unavailable);
      return;
    }
    const result = window.Papa.parse(source, {
      delimiter: "",
      newline: "",
      quoteChar: '"',
      escapeChar: '"',
      header: false,
      dynamicTyping: false,
      skipEmptyLines: false
    });
    const rows = source.length === 0 ? [] : result.data.map((row) => (Array.isArray(row) ? row : [row]).map((value) => String(value ?? "")));
    if (/\r?\n$/u.test(source) && rows.length > 0 && rows.at(-1).every((value) => value === "")) {
      rows.pop();
    }
    let columnCount = 0;
    for (const row of rows) columnCount = Math.max(columnCount, row.length);
    const firstRowIsHeader = csvHeaderModes.get(file) ?? true;
    const dataRowCount = Math.max(0, rows.length - (firstRowIsHeader ? 1 : 0));
    const messages = csvMessages(result.errors || [], rows, columnCount);
    if (dataRowCount > CSV_ROW_RENDER_LIMIT) {
      messages.push({
        text: `Показаны первые ${CSV_ROW_RENDER_LIMIT} строк данных из ${dataRowCount}`,
        error: false
      });
    }
    if (columnCount > CSV_COLUMN_RENDER_LIMIT) {
      messages.push({
        text: `Показаны первые ${CSV_COLUMN_RENDER_LIMIT} столбцов из ${columnCount}`,
        error: false
      });
    }
    csvViewer.appendChild(createCsvToolbar(file, source, rows.length, columnCount, result.meta?.delimiter || "", firstRowIsHeader));
    if (messages.length > 0) csvViewer.appendChild(createCsvMessages(messages));
    if (rows.length === 0 || columnCount === 0) {
      const empty = document.createElement("div");
      empty.className = "csv-empty";
      empty.textContent = "CSV-файл пуст";
      csvViewer.appendChild(empty);
      return;
    }
    csvViewer.appendChild(createCsvTable(rows, columnCount, firstRowIsHeader));
  }
  function createCsvToolbar(file, source, rowCount, columnCount, delimiter, firstRowIsHeader) {
    const toolbar = document.createElement("div");
    toolbar.className = "csv-toolbar";
    const summary = document.createElement("div");
    summary.className = "csv-summary";
    summary.textContent = `Строк: ${rowCount} · столбцов: ${columnCount} · разделитель: ${formatCsvDelimiter(delimiter)}`;
    toolbar.appendChild(summary);
    const option = document.createElement("label");
    option.className = "csv-header-option";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = firstRowIsHeader;
    checkbox.disabled = rowCount === 0;
    checkbox.addEventListener("change", () => {
      csvHeaderModes.set(file, checkbox.checked);
      csvViewer.replaceChildren();
      renderCsvTable(file, source);
    });
    option.appendChild(checkbox);
    option.append("Первая строка — заголовки");
    toolbar.appendChild(option);
    return toolbar;
  }
  function createCsvMessages(messages) {
    const container = document.createElement("div");
    container.className = "csv-messages";
    for (const message of messages.slice(0, 6)) {
      const item = document.createElement("p");
      item.className = "csv-message" + (message.error ? " csv-message-error" : "");
      item.textContent = message.text;
      container.appendChild(item);
    }
    if (messages.length > 6) {
      const rest = document.createElement("p");
      rest.className = "csv-message";
      rest.textContent = `И ещё предупреждений: ${messages.length - 6}`;
      container.appendChild(rest);
    }
    return container;
  }
  function csvMessages(errors, rows, columnCount) {
    const messages = [];
    for (const error of errors) {
      if (error.code === "UndetectableDelimiter" && columnCount <= 1) continue;
      messages.push({ text: formatCsvError(error), error: error.type === "Quotes" });
    }
    const irregularRows = [];
    for (let index = 0; index < rows.length; index++) {
      if (rows[index].length !== columnCount) irregularRows.push(index + 1);
    }
    if (irregularRows.length > 0) {
      const shown = irregularRows.slice(0, 8).join(", ");
      const rest = irregularRows.length > 8 ? ` и ещё ${irregularRows.length - 8}` : "";
      messages.push({
        text: `В строках разное количество столбцов. Проверь строки: ${shown}${rest}`,
        error: false
      });
    }
    return messages;
  }
  function formatCsvError(error) {
    const row = Number.isInteger(error.row) ? `Строка ${error.row + 1}: ` : "";
    const descriptions = {
      MissingQuotes: "не закрыта двойная кавычка",
      InvalidQuotes: "кавычка расположена неправильно",
      TooFewFields: "слишком мало значений",
      TooManyFields: "слишком много значений",
      UndetectableDelimiter: "не удалось уверенно определить разделитель"
    };
    return row + (descriptions[error.code] || `ошибка CSV (${error.code || error.type || "неизвестная"})`);
  }
  function formatCsvDelimiter(delimiter) {
    const names = {
      ",": "запятая (,)",
      ";": "точка с запятой (;)",
      "	": "табуляция",
      "|": "вертикальная черта (|)"
    };
    return names[delimiter] || (delimiter ? `«${delimiter}»` : "не определён");
  }
  function createCsvTable(rows, columnCount, firstRowIsHeader) {
    const scroll = document.createElement("div");
    scroll.className = "csv-table-scroll";
    const table = document.createElement("table");
    table.className = "csv-table";
    const renderedColumnCount = Math.min(columnCount, CSV_COLUMN_RENDER_LIMIT);
    const head = document.createElement("thead");
    const headerRow = document.createElement("tr");
    appendCsvCell(headerRow, "#", "th", "csv-row-number");
    for (let column = 0; column < renderedColumnCount; column++) {
      const value = firstRowIsHeader ? rows[0]?.[column] || `Столбец ${column + 1}` : `Столбец ${column + 1}`;
      appendCsvCell(headerRow, value, "th");
    }
    head.appendChild(headerRow);
    table.appendChild(head);
    const body = document.createElement("tbody");
    const firstDataIndex = firstRowIsHeader ? 1 : 0;
    const lastDataIndex = Math.min(rows.length, firstDataIndex + CSV_ROW_RENDER_LIMIT);
    for (let rowIndex = firstDataIndex; rowIndex < lastDataIndex; rowIndex++) {
      const rowElement = document.createElement("tr");
      appendCsvCell(rowElement, String(rowIndex - firstDataIndex + 1), "th", "csv-row-number");
      for (let column = 0; column < renderedColumnCount; column++) {
        appendCsvCell(rowElement, rows[rowIndex][column] || "", "td");
      }
      body.appendChild(rowElement);
    }
    table.appendChild(body);
    scroll.appendChild(table);
    return scroll;
  }
  function appendCsvCell(row, value, tagName, className = "") {
    const cell = document.createElement(tagName);
    if (className) cell.className = className;
    if (tagName === "th") cell.scope = className === "csv-row-number" ? "row" : "col";
    cell.textContent = value;
    if (value.length > 120) cell.title = value.slice(0, 1e3);
    row.appendChild(cell);
  }
  function renderJsonTree(file, source) {
    if (!jsonViewer) return;
    if (source.trim().length === 0) {
      const empty = document.createElement("div");
      empty.className = "json-empty";
      empty.textContent = "JSON-файл пуст";
      jsonViewer.appendChild(empty);
      return;
    }
    let value;
    try {
      value = JSON.parse(source);
    } catch (error) {
      jsonViewer.appendChild(createJsonError(source, error));
      return;
    }
    const state = {
      count: 0,
      compositeCount: 0,
      truncated: false,
      limitMarkerCreated: false,
      depthTruncated: false
    };
    const tree = document.createElement("div");
    tree.className = "json-tree";
    tree.appendChild(createJsonNode(value, "Корень", "root", 0, state));
    jsonViewer.appendChild(createJsonToolbar(value, state));
    if (state.truncated || state.depthTruncated) {
      const warning = document.createElement("p");
      warning.className = "json-render-warning";
      warning.textContent = state.truncated ? `Показаны первые ${JSON_NODE_RENDER_LIMIT} узлов. Полный JSON остаётся доступен в текстовом режиме.` : `Вложенность глубже ${JSON_DEPTH_RENDER_LIMIT} уровней скрыта. Полный JSON остаётся доступен в текстовом режиме.`;
      jsonViewer.appendChild(warning);
    }
    const scroll = document.createElement("div");
    scroll.className = "json-tree-scroll";
    scroll.appendChild(tree);
    jsonViewer.appendChild(scroll);
  }
  function renderMarkdownPreview(file, source) {
    if (!markdownViewer) return;
    if (!window.marked || typeof window.marked.parse !== "function" || !window.DOMPurify || typeof window.DOMPurify.sanitize !== "function") {
      appendMarkdownMessage("Не удалось загрузить модуль просмотра Markdown");
      return;
    }
    if (source.trim().length === 0) {
      appendMarkdownMessage("Markdown-файл пуст");
      return;
    }
    let rendered;
    try {
      rendered = window.marked.parse(source.replace(/^[\u200B-\u200F\uFEFF]/u, ""), {
        async: false,
        breaks: false,
        gfm: true
      });
    } catch (error) {
      appendMarkdownMessage(`Markdown не удалось разобрать: ${error instanceof Error ? error.message : String(error)}`, true);
      return;
    }
    const documentElement = document.createElement("article");
    documentElement.className = "markdown-document";
    documentElement.innerHTML = window.DOMPurify.sanitize(String(rendered), {
      FORBID_ATTR: ["style"],
      FORBID_TAGS: ["style", "script", "iframe", "object", "embed", "form"],
      SANITIZE_NAMED_PROPS: true,
      USE_PROFILES: { html: true }
    });
    prepareMarkdownLinks(documentElement, file);
    prepareMarkdownImages(documentElement, file);
    markdownViewer.appendChild(documentElement);
  }
  function appendMarkdownMessage(message, error = false) {
    const element = document.createElement("div");
    element.className = `markdown-empty${error ? " markdown-error" : ""}`;
    element.textContent = message;
    markdownViewer.appendChild(element);
  }
  function prepareMarkdownLinks(documentElement, file) {
    for (const link of documentElement.querySelectorAll("a[href]")) {
      const href = link.getAttribute("href") || "";
      if (/^(?:https?:|mailto:)/iu.test(href)) {
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        continue;
      }
      if (href.startsWith("#")) continue;
      const target = markdownWorkspaceTarget(file, href);
      if (!target || !files.has(target)) {
        link.addEventListener("click", (event) => event.preventDefault());
        link.title = "Файл не найден в текущем проекте";
        continue;
      }
      link.addEventListener("click", (event) => {
        event.preventDefault();
        viewerHost.openFile(target);
      });
    }
  }
  function prepareMarkdownImages(documentElement, file) {
    for (const image of documentElement.querySelectorAll("img[src]")) {
      const source = image.getAttribute("src") || "";
      if (/^(?:https?:|data:|blob:)/iu.test(source)) continue;
      const target = markdownWorkspaceTarget(file, source);
      const item = target ? files.get(target) : null;
      if (!item || item.kind !== "asset") continue;
      const bytes = item.bytes instanceof Uint8Array ? item.bytes : assetBytes(item);
      image.src = bytes.length > 0 ? bytesToDataUrl(target, bytes) : item.resourceUri || source;
    }
  }
  function markdownWorkspaceTarget(file, reference) {
    const pathOnly = String(reference).split(/[?#]/u, 1)[0];
    if (!pathOnly) return "";
    let decoded;
    try {
      decoded = decodeURIComponent(pathOnly);
    } catch {
      decoded = pathOnly;
    }
    if (decoded.startsWith("/")) return normalizeWorkspacePath(decoded);
    const parent = shortFileName(parentPath(file));
    return normalizeWorkspacePath(parent ? `${parent}/${decoded}` : decoded);
  }
  function createJsonToolbar(value, state) {
    const toolbar = document.createElement("div");
    toolbar.className = "json-toolbar";
    const summary = document.createElement("div");
    summary.className = "json-summary";
    summary.textContent = `${describeJsonRoot(value)} · показано узлов: ${state.count}`;
    toolbar.appendChild(summary);
    const actions = document.createElement("div");
    actions.className = "json-toolbar-actions";
    const expand = createJsonToolbarButton("Развернуть всё", () => {
      for (const details of jsonViewer.querySelectorAll("details")) details.open = true;
    });
    const collapse = createJsonToolbarButton("Свернуть всё", () => {
      for (const details of jsonViewer.querySelectorAll("details")) details.open = false;
    });
    expand.disabled = state.compositeCount === 0;
    collapse.disabled = state.compositeCount === 0;
    actions.append(expand, collapse);
    toolbar.appendChild(actions);
    return toolbar;
  }
  function createJsonToolbarButton(label, onClick) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "json-toolbar-button";
    button.textContent = label;
    button.addEventListener("click", onClick);
    return button;
  }
  function createJsonNode(value, label, labelKind, depth, state) {
    state.count++;
    const node = document.createElement("div");
    node.className = "json-node";
    const composite = value !== null && typeof value === "object";
    if (!composite) {
      const line = document.createElement("div");
      line.className = "json-node-line json-leaf";
      appendJsonLabel(line, label, labelKind);
      appendJsonPrimitive(line, value);
      node.appendChild(line);
      return node;
    }
    const keys = Array.isArray(value) ? value.map((_, index) => index) : Object.keys(value);
    const collectionKind = Array.isArray(value) ? "array" : "object";
    if (keys.length === 0 || depth >= JSON_DEPTH_RENDER_LIMIT) {
      const line = document.createElement("div");
      line.className = "json-node-line json-leaf";
      appendJsonLabel(line, label, labelKind);
      appendJsonCollectionPreview(line, collectionKind, keys.length);
      if (depth >= JSON_DEPTH_RENDER_LIMIT && keys.length > 0) {
        state.depthTruncated = true;
        const hidden = document.createElement("span");
        hidden.className = "json-meta";
        hidden.textContent = " вложенность скрыта";
        line.appendChild(hidden);
      }
      node.appendChild(line);
      return node;
    }
    state.compositeCount++;
    const details = document.createElement("details");
    details.className = "json-composite";
    details.open = depth === 0;
    const summary = document.createElement("summary");
    summary.className = "json-node-line";
    appendJsonLabel(summary, label, labelKind);
    appendJsonCollectionPreview(summary, collectionKind, keys.length);
    details.appendChild(summary);
    const children = document.createElement("div");
    children.className = "json-children";
    for (const key of keys) {
      if (state.count >= JSON_NODE_RENDER_LIMIT) {
        state.truncated = true;
        if (!state.limitMarkerCreated) {
          state.limitMarkerCreated = true;
          children.appendChild(createJsonLimitMarker());
        }
        break;
      }
      const child = Array.isArray(value) ? createJsonNode(value[key], `[${key}]`, "index", depth + 1, state) : createJsonNode(value[key], key, "key", depth + 1, state);
      children.appendChild(child);
    }
    details.appendChild(children);
    node.appendChild(details);
    return node;
  }
  function appendJsonLabel(parent, label, kind) {
    const key = document.createElement("span");
    key.className = kind === "root" ? "json-root-label" : kind === "index" ? "json-index" : "json-key";
    key.textContent = kind === "key" ? JSON.stringify(label) : label;
    parent.appendChild(key);
    const separator = document.createElement("span");
    separator.className = "json-punctuation";
    separator.textContent = ": ";
    parent.appendChild(separator);
  }
  function appendJsonPrimitive(parent, value) {
    const type = value === null ? "null" : typeof value;
    const rendered = type === "string" ? JSON.stringify(value) : String(value);
    const token = document.createElement("span");
    token.className = `json-value json-value-${type}`;
    token.textContent = rendered;
    parent.appendChild(token);
  }
  function appendJsonCollectionPreview(parent, kind, count) {
    const punctuation = document.createElement("span");
    punctuation.className = "json-punctuation";
    punctuation.textContent = kind === "array" ? count === 0 ? "[]" : "[…]" : count === 0 ? "{}" : "{…}";
    parent.appendChild(punctuation);
    const meta = document.createElement("span");
    meta.className = "json-meta";
    meta.textContent = kind === "array" ? ` ${formatRussianCount(count, ["элемент", "элемента", "элементов"])}` : ` ${formatRussianCount(count, ["поле", "поля", "полей"])}`;
    parent.appendChild(meta);
  }
  function createJsonLimitMarker() {
    const marker = document.createElement("div");
    marker.className = "json-node-line json-limit-marker";
    marker.textContent = "Остальные узлы скрыты";
    return marker;
  }
  function describeJsonRoot(value) {
    if (Array.isArray(value)) {
      return `Корень: массив · ${formatRussianCount(value.length, ["элемент", "элемента", "элементов"])}`;
    }
    if (value !== null && typeof value === "object") {
      return `Корень: объект · ${formatRussianCount(Object.keys(value).length, ["поле", "поля", "полей"])}`;
    }
    const names = {
      string: "строка",
      number: "число",
      boolean: "логическое значение",
      null: "null"
    };
    const type = value === null ? "null" : typeof value;
    return `Корень: ${names[type] || type}`;
  }
  function formatRussianCount(count, forms) {
    const mod10 = count % 10;
    const mod100 = count % 100;
    const form = mod10 === 1 && mod100 !== 11 ? forms[0] : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? forms[1] : forms[2];
    return `${count} ${form}`;
  }
  function createJsonError(source, error) {
    const location2 = jsonErrorLocation(source, error);
    const card = document.createElement("div");
    card.className = "json-error";
    const title = document.createElement("strong");
    title.textContent = "JSON не удалось разобрать";
    card.appendChild(title);
    const description = document.createElement("p");
    description.textContent = `${location2.label}${describeJsonSyntaxError(error)}`;
    card.appendChild(description);
    if (location2.lineText !== "") {
      const snippet = document.createElement("pre");
      snippet.className = "json-error-snippet";
      snippet.textContent = `${location2.lineText}
${" ".repeat(Math.max(0, location2.column - 1))}^`;
      card.appendChild(snippet);
    }
    const hint = document.createElement("p");
    hint.className = "json-error-hint";
    hint.textContent = "Вернитесь в режим «Текст», исправьте JSON и откройте дерево снова.";
    card.appendChild(hint);
    return card;
  }
  function jsonErrorLocation(source, error) {
    const message = String(error?.message || "");
    const lineColumn = message.match(/line\s+(\d+)\s+column\s+(\d+)/iu);
    if (lineColumn) {
      const line2 = Number(lineColumn[1]);
      const column2 = Number(lineColumn[2]);
      return {
        line: line2,
        column: column2,
        lineText: source.split(/\r\n|\r|\n/u)[line2 - 1] || "",
        label: `Строка ${line2}, столбец ${column2}: `
      };
    }
    const positionMatch = message.match(/position\s+(\d+)/iu);
    const position = positionMatch ? Number(positionMatch[1]) : source.length;
    const before = source.slice(0, position);
    const lines = before.split(/\r\n|\r|\n/u);
    const line = lines.length;
    const column = (lines.at(-1)?.length || 0) + 1;
    return {
      line,
      column,
      lineText: source.split(/\r\n|\r|\n/u)[line - 1] || "",
      label: `Строка ${line}, столбец ${column}: `
    };
  }
  function describeJsonSyntaxError(error) {
    const message = String(error?.message || "");
    if (/unterminated string/iu.test(message)) return "не закрыта двойная кавычка.";
    if (/end of JSON|unexpected end/iu.test(message)) return "JSON неожиданно закончился. Проверьте закрывающие скобки и значения.";
    if (/property name|double-quoted/iu.test(message)) return "ключ объекта должен находиться в двойных кавычках.";
    if (/expected ['"]?,['"]?|after property value|after array element/iu.test(message)) return "между соседними значениями, полями или элементами нужна запятая.";
    if (/non-whitespace character after JSON|after JSON data/iu.test(message)) return "после завершённого JSON обнаружены лишние символы.";
    return "нарушен синтаксис JSON. Проверьте кавычки, запятые и скобки.";
  }
  var structuredViewModes = /* @__PURE__ */ new Map();
  function isCsvFile(file) {
    return /\.csv$/iu.test(file);
  }
  function isJsonFile(file) {
    return /\.json$/iu.test(file);
  }
  function isMarkdownFile(file) {
    return /\.(?:md|markdown)$/iu.test(file);
  }
  function isSvgFile(file) {
    return /\.svg$/iu.test(file);
  }
  function structuredViewMode(file) {
    if (isCsvFile(file)) return "table";
    if (isJsonFile(file)) return "tree";
    if (isMarkdownFile(file)) return "preview";
    if (isSvgFile(file)) return "image";
    return "";
  }

  // packages/web-ide/src/viewer-assets.js
  var assetViewerGeneration = 0;
  var assetFontCounter = 0;
  var activeAssetFontFace = null;
  var activeAssetImageCleanup = null;
  function invalidateAssetPreview() {
    assetViewerGeneration += 1;
  }
  function showAssetViewer(file, item) {
    if (monacoHost) monacoHost.hidden = true;
    if (legacyEditor) legacyEditor.hidden = true;
    if (csvViewer) {
      csvViewer.hidden = true;
      csvViewer.replaceChildren();
    }
    if (jsonViewer) {
      jsonViewer.hidden = true;
      jsonViewer.replaceChildren();
    }
    if (markdownViewer) {
      markdownViewer.hidden = true;
      markdownViewer.replaceChildren();
    }
    if (!assetViewer) return;
    assetViewer.hidden = false;
    assetViewer.replaceChildren();
    releaseAssetViewerResources();
    const generation = ++assetViewerGeneration;
    const bytes = item.bytes instanceof Uint8Array ? item.bytes : assetBytes(item);
    const detectedMime = detectAssetMimeType(file, bytes);
    const extensionMime = mimeTypeForFile(file);
    const isImage = detectedMime.startsWith("image/");
    const isAudio = detectedMime.startsWith("audio/");
    const isFont = detectedMime.startsWith("font/");
    const isSqlite = detectedMime === "application/vnd.sqlite3";
    const alpha = isImage ? imageAlphaInfo(detectedMime, bytes) : "нет";
    const preview = document.createElement("div");
    preview.className = "asset-preview";
    assetViewer.appendChild(preview);
    const details = document.createElement("dl");
    details.className = "asset-details";
    assetViewer.appendChild(details);
    addAssetDetail(details, "Файл", shortFileName(file));
    addAssetDetail(details, "Размер файла", formatBytes(bytes.length));
    addAssetDetail(details, "Тип по расширению", extensionMime);
    addAssetDetail(details, "Фактический тип", detectedMime);
    if (isSqlite) {
      addAssetDetail(details, "Объекты", "загрузка...");
      addAssetDetail(details, "Версия схемы", "загрузка...");
      addAssetDetail(details, "Размер страницы", "загрузка...");
      addAssetDetail(details, "Страниц", "загрузка...");
    } else if (isAudio) {
      addAssetDetail(details, "Длительность", "загрузка...");
    } else if (isFont) {
      addAssetDetail(details, "Формат", fontFormatName(detectedMime));
      addAssetDetail(details, "Состояние", "загрузка...");
      addAssetDetail(details, "Проверка символов", "визуальная");
    } else {
      addAssetDetail(details, "Ширина", isImage ? "загрузка..." : "нет");
      addAssetDetail(details, "Высота", isImage ? "загрузка..." : "нет");
      addAssetDetail(details, "Альфа-канал", alpha);
    }
    if (extensionMime !== detectedMime && detectedMime !== "application/octet-stream") {
      addAssetDetail(details, "Несовпадение типа", `${extensionMime} -> ${detectedMime}`, true);
    }
    if (isSqlite) {
      void renderSqliteAssetPreview(file, bytes, preview, details, generation);
      return;
    }
    if (isAudio) {
      const audio = document.createElement("audio");
      audio.className = "asset-audio-player";
      audio.controls = true;
      audio.preload = "metadata";
      audio.addEventListener("loadedmetadata", () => {
        updateAssetDetail(details, "Длительность", formatDuration(audio.duration));
      });
      audio.addEventListener("error", () => {
        updateAssetDetail(details, "Длительность", "ошибка");
      });
      audio.src = bytes.length > 0 ? bytesToDataUrlWithMime(detectedMime, bytes) : item.resourceUri;
      preview.classList.add("asset-preview-audio");
      preview.appendChild(audio);
      return;
    }
    if (isFont) {
      void renderFontAssetPreview(file, item, bytes, preview, details, generation);
      return;
    }
    if (!isImage) {
      const empty = document.createElement("div");
      empty.className = "asset-preview-empty";
      empty.textContent = "Предпросмотр для этого типа файла пока недоступен";
      preview.appendChild(empty);
      return;
    }
    renderImageAssetPreview(file, item, bytes, detectedMime, preview, details, generation);
  }
  async function renderSqliteAssetPreview(file, bytes, preview, details, generation) {
    preview.classList.add("asset-preview-sqlite");
    showSqliteViewerMessage(preview, "Открываем базу данных...");
    if (typeof window.Idyllium?.inspectSqliteDatabaseInBrowser !== "function" || typeof window.Idyllium?.previewSqliteObjectInBrowser !== "function") {
      showSqliteViewerError(preview, "Модуль просмотра SQLite не загрузился.");
      return;
    }
    try {
      const description = await window.Idyllium.inspectSqliteDatabaseInBrowser(bytes);
      if (!isCurrentAssetPreview(file, preview, generation)) return;
      updateAssetDetail(details, "Объекты", String(description.objectCount));
      updateAssetDetail(details, "Версия схемы", String(description.userVersion));
      updateAssetDetail(details, "Размер страницы", formatBytes(description.pageSize));
      updateAssetDetail(details, "Страниц", String(description.pageCount));
      preview.replaceChildren(createSqliteInspector(file, bytes, description, preview, generation));
    } catch (error) {
      if (!isCurrentAssetPreview(file, preview, generation)) return;
      updateAssetDetail(details, "Объекты", "ошибка");
      updateAssetDetail(details, "Версия схемы", "неизвестно");
      updateAssetDetail(details, "Размер страницы", "неизвестно");
      updateAssetDetail(details, "Страниц", "неизвестно");
      showSqliteViewerError(preview, sqliteInspectorError(error));
    }
  }
  function createSqliteInspector(file, bytes, description, preview, generation) {
    const inspector = document.createElement("div");
    inspector.className = "sqlite-inspector";
    const sidebar = document.createElement("aside");
    sidebar.className = "sqlite-sidebar";
    const sidebarHeader = document.createElement("div");
    sidebarHeader.className = "sqlite-sidebar-header";
    const sidebarTitle = document.createElement("strong");
    sidebarTitle.textContent = "Объекты";
    const sidebarCount = document.createElement("span");
    sidebarCount.textContent = String(description.objectCount);
    sidebarHeader.append(sidebarTitle, sidebarCount);
    sidebar.appendChild(sidebarHeader);
    const objectList = document.createElement("div");
    objectList.className = "sqlite-object-list";
    sidebar.appendChild(objectList);
    const content = document.createElement("section");
    content.className = "sqlite-object-view";
    inspector.append(sidebar, content);
    if (description.objects.length === 0) {
      const emptyList = document.createElement("p");
      emptyList.className = "sqlite-sidebar-empty";
      emptyList.textContent = "Таблиц и представлений нет";
      objectList.appendChild(emptyList);
      showSqliteViewerMessage(content, "База данных открылась, но пользовательских таблиц и представлений в ней пока нет.");
      return inspector;
    }
    const buttons = /* @__PURE__ */ new Map();
    let selectedObject = null;
    let selectedTab = "data";
    let selectionSequence = 0;
    const previewCache = /* @__PURE__ */ new Map();
    const selectObject = (object) => {
      selectedObject = object;
      selectedTab = "data";
      selectionSequence++;
      for (const [name, button] of buttons) button.classList.toggle("active", name === object.name);
      renderSelectedObject();
    };
    for (const object of description.objects) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "sqlite-object-button";
      button.title = object.name;
      const badge = document.createElement("span");
      badge.className = `sqlite-object-kind sqlite-object-kind-${object.kind}`;
      badge.textContent = object.kind === "table" ? "T" : "V";
      badge.setAttribute("aria-hidden", "true");
      const name = document.createElement("span");
      name.className = "sqlite-object-name";
      name.textContent = object.name;
      button.append(badge, name);
      button.addEventListener("click", () => selectObject(object));
      objectList.appendChild(button);
      buttons.set(object.name, button);
    }
    if (description.truncatedObjectCount > 0) {
      const warning = document.createElement("p");
      warning.className = "sqlite-sidebar-note";
      warning.textContent = `Скрыто объектов: ${description.truncatedObjectCount}`;
      sidebar.appendChild(warning);
    }
    if (description.hiddenSystemObjectCount > 0) {
      const note = document.createElement("p");
      note.className = "sqlite-sidebar-note";
      note.textContent = `Системных таблиц скрыто: ${description.hiddenSystemObjectCount}`;
      sidebar.appendChild(note);
    }
    function renderSelectedObject() {
      if (!selectedObject) return;
      const object = selectedObject;
      const requestSequence = selectionSequence;
      content.replaceChildren();
      const header = document.createElement("header");
      header.className = "sqlite-object-header";
      const identity = document.createElement("div");
      identity.className = "sqlite-object-identity";
      const title = document.createElement("strong");
      title.textContent = object.name;
      const kind = document.createElement("span");
      kind.textContent = object.kind === "table" ? "Таблица" : "Представление";
      identity.append(title, kind);
      const tabs = document.createElement("div");
      tabs.className = "sqlite-object-tabs";
      tabs.setAttribute("role", "tablist");
      const dataButton = createSqliteTabButton("Данные", "data");
      const schemaButton = createSqliteTabButton("Схема", "schema");
      tabs.append(dataButton, schemaButton);
      header.append(identity, tabs);
      content.appendChild(header);
      const body = document.createElement("div");
      body.className = "sqlite-object-body";
      content.appendChild(body);
      function createSqliteTabButton(label, tab) {
        const button = document.createElement("button");
        button.type = "button";
        button.role = "tab";
        button.textContent = label;
        button.addEventListener("click", () => {
          selectedTab = tab;
          updateTabs();
          renderTab();
        });
        return button;
      }
      function updateTabs() {
        for (const [button, tab] of [[dataButton, "data"], [schemaButton, "schema"]]) {
          const active = selectedTab === tab;
          button.classList.toggle("active", active);
          button.setAttribute("aria-selected", String(active));
        }
      }
      function renderTab() {
        body.replaceChildren();
        if (selectedTab === "schema") {
          renderSqliteSchema(body, object);
          return;
        }
        const cached = previewCache.get(object.name);
        if (cached) {
          renderSqliteData(body, cached);
          return;
        }
        showSqliteViewerMessage(body, "Читаем строки...");
        void window.Idyllium.previewSqliteObjectInBrowser(bytes, object.name, 200).then((result) => {
          previewCache.set(object.name, result);
          if (!isCurrentAssetPreview(file, preview, generation) || selectedObject?.name !== object.name || selectionSequence !== requestSequence || selectedTab !== "data") return;
          body.replaceChildren();
          renderSqliteData(body, result);
        }).catch((error) => {
          if (!isCurrentAssetPreview(file, preview, generation) || selectedObject?.name !== object.name || selectionSequence !== requestSequence || selectedTab !== "data") return;
          showSqliteViewerError(body, sqliteInspectorError(error));
        });
      }
      updateTabs();
      renderTab();
    }
    selectObject(description.objects[0]);
    return inspector;
  }
  function renderSqliteSchema(parent, object) {
    const scroll = document.createElement("div");
    scroll.className = "sqlite-schema-scroll";
    const summary = document.createElement("p");
    summary.className = "sqlite-schema-summary";
    summary.textContent = formatRussianCount(object.columns.length, ["столбец", "столбца", "столбцов"]);
    scroll.appendChild(summary);
    if (object.sql) {
      const sqlLabel = document.createElement("div");
      sqlLabel.className = "sqlite-schema-label";
      sqlLabel.textContent = "SQL создания";
      const sql = document.createElement("pre");
      sql.className = "sqlite-schema-sql";
      sql.textContent = object.sql;
      scroll.append(sqlLabel, sql);
    }
    if (object.columns.length > 0) {
      const tableScroll = document.createElement("div");
      tableScroll.className = "sqlite-table-scroll sqlite-schema-table-scroll";
      const table = document.createElement("table");
      table.className = "sqlite-table sqlite-schema-table";
      appendSqliteHeaderRow(table, ["#", "Столбец", "Тип", "NOT NULL", "DEFAULT", "PK"]);
      const body = document.createElement("tbody");
      for (const column of object.columns) {
        const row = document.createElement("tr");
        appendSqliteTextCell(row, String(column.index), "th", "sqlite-row-number");
        appendSqliteTextCell(row, column.name, "td");
        appendSqliteTextCell(row, column.declaredType || "не указан", "td", column.declaredType ? "" : "sqlite-muted-value");
        appendSqliteTextCell(row, column.notNull ? "да" : "нет", "td");
        appendSqliteTextCell(row, column.defaultValue ?? "нет", "td", column.defaultValue === null ? "sqlite-muted-value" : "");
        appendSqliteTextCell(row, column.primaryKeyPosition > 0 ? String(column.primaryKeyPosition) : "нет", "td", column.primaryKeyPosition > 0 ? "" : "sqlite-muted-value");
        body.appendChild(row);
      }
      table.appendChild(body);
      tableScroll.appendChild(table);
      scroll.appendChild(tableScroll);
    }
    parent.appendChild(scroll);
  }
  function renderSqliteData(parent, result) {
    const summary = document.createElement("div");
    summary.className = "sqlite-data-summary";
    const shown = result.rows.length;
    summary.textContent = `Строк: ${result.totalRows} · показано: ${shown}`;
    parent.appendChild(summary);
    if (result.truncatedRows || result.truncatedColumns) {
      const warning = document.createElement("p");
      warning.className = "sqlite-preview-warning";
      const parts = [];
      if (result.truncatedRows) parts.push("показаны первые 200 строк");
      if (result.truncatedColumns) parts.push(`показаны первые ${result.columns.length} столбцов из ${result.totalColumns}`);
      warning.textContent = parts.join(" · ");
      parent.appendChild(warning);
    }
    if (result.columns.length === 0) {
      showSqliteViewerMessage(parent, "У объекта нет доступных столбцов.");
      return;
    }
    const scroll = document.createElement("div");
    scroll.className = "sqlite-table-scroll";
    const table = document.createElement("table");
    table.className = "sqlite-table sqlite-data-table";
    appendSqliteHeaderRow(table, ["#", ...result.columns]);
    const body = document.createElement("tbody");
    for (let rowIndex = 0; rowIndex < result.rows.length; rowIndex++) {
      const row = document.createElement("tr");
      appendSqliteTextCell(row, String(rowIndex + 1), "th", "sqlite-row-number");
      for (const value of result.rows[rowIndex]) appendSqliteValueCell(row, value);
      body.appendChild(row);
    }
    table.appendChild(body);
    scroll.appendChild(table);
    parent.appendChild(scroll);
    if (result.rows.length === 0) {
      const empty = document.createElement("p");
      empty.className = "sqlite-empty-table";
      empty.textContent = "В таблице пока нет строк";
      scroll.appendChild(empty);
    }
  }
  function appendSqliteHeaderRow(table, labels) {
    const head = document.createElement("thead");
    const row = document.createElement("tr");
    for (let index = 0; index < labels.length; index++) {
      appendSqliteTextCell(row, labels[index], "th", index === 0 ? "sqlite-row-number" : "");
    }
    head.appendChild(row);
    table.appendChild(head);
  }
  function appendSqliteTextCell(row, value, tagName, className = "") {
    const cell = document.createElement(tagName);
    if (className) cell.className = className;
    cell.textContent = value;
    if (value.length > 120) cell.title = value.slice(0, 1e3);
    row.appendChild(cell);
  }
  function appendSqliteValueCell(row, value) {
    const cell = document.createElement("td");
    if (value === null) {
      cell.className = "sqlite-value-null";
      cell.textContent = "null";
    } else if (value instanceof Uint8Array) {
      cell.className = "sqlite-value-blob";
      cell.textContent = `<BLOB ${formatBytes(value.length)}>`;
    } else {
      cell.textContent = String(value);
      if (typeof value === "number" || typeof value === "bigint") cell.className = "sqlite-value-number";
    }
    if (cell.textContent.length > 120) cell.title = cell.textContent.slice(0, 1e3);
    row.appendChild(cell);
  }
  function showSqliteViewerMessage(parent, message) {
    parent.replaceChildren();
    const element = document.createElement("div");
    element.className = "sqlite-viewer-message";
    element.textContent = message;
    parent.appendChild(element);
  }
  function showSqliteViewerError(parent, message) {
    parent.replaceChildren();
    const error = document.createElement("div");
    error.className = "sqlite-viewer-error";
    const title = document.createElement("strong");
    title.textContent = "Базу данных не удалось открыть";
    const detail = document.createElement("p");
    detail.textContent = message;
    error.append(title, detail);
    parent.appendChild(error);
  }
  function sqliteInspectorError(error) {
    const message = error instanceof Error ? error.message : String(error || "неизвестная ошибка");
    if (/not a database|file is encrypted/iu.test(message)) {
      return "Файл не является корректной SQLite-базой или повреждён.";
    }
    return message.replace(/^SQLite execution failed:\s*/iu, "");
  }
  function renderImageAssetPreview(file, item, bytes, detectedMime, preview, details, generation) {
    preview.classList.add("asset-preview-image");
    const toolbar = document.createElement("div");
    toolbar.className = "asset-image-toolbar";
    const zoomOut = createAssetImageButton("zoom-out", "Уменьшить");
    const scaleValue = document.createElement("output");
    scaleValue.className = "asset-image-scale";
    scaleValue.value = "100%";
    scaleValue.textContent = "100%";
    scaleValue.setAttribute("aria-live", "polite");
    const zoomIn = createAssetImageButton("zoom-in", "Увеличить");
    const actualSize = document.createElement("button");
    actualSize.type = "button";
    actualSize.className = "asset-image-button asset-image-actual-size";
    actualSize.textContent = "1:1";
    actualSize.title = "Исходный размер";
    actualSize.setAttribute("aria-label", "Показать в исходном размере");
    const fit = createAssetImageButton("fit", "Вписать в область");
    toolbar.append(zoomOut, scaleValue, zoomIn, actualSize, fit);
    const viewport = document.createElement("div");
    viewport.className = "asset-image-viewport";
    viewport.tabIndex = 0;
    viewport.setAttribute("aria-label", `Предпросмотр изображения ${shortFileName(file)}`);
    const image = document.createElement("img");
    image.alt = shortFileName(file);
    image.draggable = false;
    viewport.appendChild(image);
    preview.append(toolbar, viewport);
    const state = {
      scale: 1,
      panX: 0,
      panY: 0,
      naturalWidth: 1,
      naturalHeight: 1,
      fitted: true,
      pointerId: null,
      pointerX: 0,
      pointerY: 0,
      startPanX: 0,
      startPanY: 0
    };
    const minScale = 0.01;
    const maxScale = 16;
    const applyTransform = () => {
      const bounds = viewport.getBoundingClientRect();
      const width = state.naturalWidth * state.scale;
      const height = state.naturalHeight * state.scale;
      const maxPanX = Math.max(0, (width - bounds.width) / 2);
      const maxPanY = Math.max(0, (height - bounds.height) / 2);
      state.panX = clamp(state.panX, -maxPanX, maxPanX);
      state.panY = clamp(state.panY, -maxPanY, maxPanY);
      image.style.width = `${width}px`;
      image.style.height = `${height}px`;
      image.style.left = `calc(50% + ${state.panX}px)`;
      image.style.top = `calc(50% + ${state.panY}px)`;
      scaleValue.value = `${Math.round(state.scale * 100)}%`;
      scaleValue.textContent = scaleValue.value;
      zoomOut.disabled = state.scale <= minScale + 1e-4;
      zoomIn.disabled = state.scale >= maxScale - 1e-4;
      viewport.classList.toggle("can-pan", maxPanX > 0 || maxPanY > 0);
    };
    const setScale = (nextScale, anchor = null) => {
      const previousScale = state.scale;
      const scale = clamp(nextScale, minScale, maxScale);
      if (Math.abs(scale - previousScale) < 1e-4) return;
      if (anchor) {
        const bounds = viewport.getBoundingClientRect();
        const centerX = bounds.width / 2;
        const centerY = bounds.height / 2;
        const sourceX = (anchor.x - centerX - state.panX) / previousScale;
        const sourceY = (anchor.y - centerY - state.panY) / previousScale;
        state.panX = anchor.x - centerX - sourceX * scale;
        state.panY = anchor.y - centerY - sourceY * scale;
      }
      state.scale = scale;
      state.fitted = false;
      applyTransform();
    };
    const fitImage = () => {
      const bounds = viewport.getBoundingClientRect();
      const availableWidth = Math.max(1, bounds.width - 28);
      const availableHeight = Math.max(1, bounds.height - 28);
      state.scale = clamp(Math.min(
        availableWidth / state.naturalWidth,
        availableHeight / state.naturalHeight,
        1
      ), minScale, maxScale);
      state.panX = 0;
      state.panY = 0;
      state.fitted = true;
      applyTransform();
    };
    zoomOut.addEventListener("click", () => setScale(state.scale / 1.25));
    zoomIn.addEventListener("click", () => setScale(state.scale * 1.25));
    actualSize.addEventListener("click", () => {
      state.scale = 1;
      state.panX = 0;
      state.panY = 0;
      state.fitted = false;
      applyTransform();
    });
    fit.addEventListener("click", fitImage);
    viewport.addEventListener("wheel", (event) => {
      event.preventDefault();
      const bounds = viewport.getBoundingClientRect();
      const factor = Math.exp(-event.deltaY * 15e-4);
      setScale(state.scale * factor, {
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top
      });
    }, { passive: false });
    viewport.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || !viewport.classList.contains("can-pan")) return;
      event.preventDefault();
      state.pointerId = event.pointerId;
      state.pointerX = event.clientX;
      state.pointerY = event.clientY;
      state.startPanX = state.panX;
      state.startPanY = state.panY;
      viewport.setPointerCapture(event.pointerId);
      viewport.classList.add("dragging");
    });
    viewport.addEventListener("pointermove", (event) => {
      if (state.pointerId !== event.pointerId) return;
      state.panX = state.startPanX + event.clientX - state.pointerX;
      state.panY = state.startPanY + event.clientY - state.pointerY;
      state.fitted = false;
      applyTransform();
    });
    const finishDragging = (event) => {
      if (state.pointerId !== event.pointerId) return;
      if (viewport.hasPointerCapture(event.pointerId)) viewport.releasePointerCapture(event.pointerId);
      state.pointerId = null;
      viewport.classList.remove("dragging");
    };
    viewport.addEventListener("pointerup", finishDragging);
    viewport.addEventListener("pointercancel", finishDragging);
    viewport.addEventListener("lostpointercapture", (event) => {
      if (state.pointerId !== event.pointerId) return;
      state.pointerId = null;
      viewport.classList.remove("dragging");
    });
    image.addEventListener("load", () => {
      if (!isCurrentAssetPreview(file, preview, generation)) return;
      state.naturalWidth = Math.max(1, image.naturalWidth);
      state.naturalHeight = Math.max(1, image.naturalHeight);
      updateAssetDetail(details, "Ширина", `${image.naturalWidth}px`);
      updateAssetDetail(details, "Высота", `${image.naturalHeight}px`);
      window.requestAnimationFrame(fitImage);
      const resizeObserver = typeof ResizeObserver === "function" ? new ResizeObserver(() => {
        if (!isCurrentAssetPreview(file, preview, generation)) {
          resizeObserver.disconnect();
          return;
        }
        if (state.fitted) fitImage();
        else applyTransform();
      }) : null;
      resizeObserver?.observe(viewport);
      activeAssetImageCleanup = () => resizeObserver?.disconnect();
    });
    image.addEventListener("error", () => {
      if (!isCurrentAssetPreview(file, preview, generation)) return;
      preview.classList.remove("asset-preview-image");
      preview.replaceChildren();
      const empty = document.createElement("div");
      empty.className = "asset-preview-empty";
      empty.textContent = "Не удалось прочитать изображение";
      preview.appendChild(empty);
      updateAssetDetail(details, "Ширина", "ошибка");
      updateAssetDetail(details, "Высота", "ошибка");
    });
    image.src = bytes.length > 0 ? bytesToDataUrlWithMime(detectedMime, bytes) : item.resourceUri;
  }
  function createAssetImageButton(icon, label) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "icon-button asset-image-button";
    button.title = label;
    button.setAttribute("aria-label", label);
    button.appendChild(createIcon(icon));
    return button;
  }
  async function renderFontAssetPreview(file, item, bytes, preview, details, generation) {
    preview.classList.add("asset-preview-font");
    const loading = document.createElement("div");
    loading.className = "asset-preview-empty";
    loading.textContent = "Загружаем шрифт...";
    preview.appendChild(loading);
    if (typeof FontFace !== "function" || !document.fonts || typeof document.fonts.add !== "function") {
      loading.textContent = "Этот браузер не поддерживает предпросмотр шрифтов";
      updateAssetDetail(details, "Состояние", "не поддерживается");
      return;
    }
    const family = `IdylliumAssetPreview${++assetFontCounter}`;
    const source = bytes.length > 0 ? bytes.slice().buffer : `url(${JSON.stringify(item.resourceUri || "")})`;
    try {
      const face = await new FontFace(family, source).load();
      if (!isCurrentAssetPreview(file, preview, generation)) return;
      document.fonts.add(face);
      activeAssetFontFace = face;
      updateAssetDetail(details, "Состояние", "загружен");
      preview.replaceChildren(createFontPreviewContent(family));
    } catch (error) {
      if (!isCurrentAssetPreview(file, preview, generation)) return;
      loading.textContent = "Не удалось прочитать шрифт";
      loading.title = error instanceof Error ? error.message : String(error);
      updateAssetDetail(details, "Состояние", "ошибка загрузки");
    }
  }
  function createFontPreviewContent(family) {
    const content = document.createElement("div");
    content.className = "asset-font-preview";
    content.style.setProperty("--asset-font-size", "36px");
    const toolbar = document.createElement("div");
    toolbar.className = "asset-font-toolbar";
    const label = document.createElement("label");
    label.className = "asset-font-size-label";
    const range = document.createElement("input");
    range.type = "range";
    range.min = "12";
    range.max = "96";
    range.step = "1";
    range.value = "36";
    range.className = "asset-font-size-range";
    range.setAttribute("aria-label", "Размер текста предпросмотра");
    const value = document.createElement("output");
    value.className = "asset-font-size-value";
    value.value = "36 px";
    value.textContent = "36 px";
    range.addEventListener("input", () => {
      const size = Number(range.value);
      content.style.setProperty("--asset-font-size", `${size}px`);
      value.value = `${size} px`;
      value.textContent = `${size} px`;
    });
    label.appendChild(range);
    label.appendChild(value);
    const colorField = document.createElement("input");
    colorField.type = "text";
    colorField.className = "asset-font-color-input";
    colorField.placeholder = "colors.RGB(120, 200, 255)";
    colorField.spellcheck = false;
    colorField.setAttribute("aria-label", "Цвет текста предпросмотра — фабрика colors");
    colorField.addEventListener("input", () => {
      const text = colorField.value.trim();
      if (text === "") {
        content.style.removeProperty("--asset-font-color");
        colorField.classList.remove("invalid");
        return;
      }
      const parsed = parseColorsFactory(text);
      if (parsed) {
        content.style.setProperty("--asset-font-color", parsed);
        colorField.classList.remove("invalid");
      } else {
        colorField.classList.add("invalid");
      }
    });
    const caps = document.createElement("label");
    caps.className = "asset-font-caps-label";
    const capsInput = document.createElement("input");
    capsInput.type = "checkbox";
    capsInput.className = "asset-font-caps-input";
    capsInput.setAttribute("aria-label", "Показывать заглавные буквы");
    const capsText = document.createElement("span");
    capsText.textContent = "Caps Lock";
    capsInput.addEventListener("change", () => {
      content.classList.toggle("caps-on", capsInput.checked);
    });
    caps.appendChild(capsInput);
    caps.appendChild(capsText);
    const makeStyleButton = (text, className, ariaLabel, toggleClass) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `asset-font-style-button ${className}`;
      button.textContent = text;
      button.title = ariaLabel;
      button.setAttribute("aria-label", ariaLabel);
      button.setAttribute("aria-pressed", "false");
      button.addEventListener("click", () => {
        const active = !content.classList.contains(toggleClass);
        content.classList.toggle(toggleClass, active);
        button.classList.toggle("active", active);
        button.setAttribute("aria-pressed", String(active));
      });
      return button;
    };
    const boldButton = makeStyleButton("Ж", "asset-font-bold-button", "Показать жирное начертание", "bold-on");
    const italicButton = makeStyleButton("К", "asset-font-italic-button", "Показать курсивное начертание", "italic-on");
    toolbar.appendChild(caps);
    toolbar.appendChild(boldButton);
    toolbar.appendChild(italicButton);
    toolbar.appendChild(colorField);
    toolbar.appendChild(label);
    content.appendChild(toolbar);
    const samples = document.createElement("div");
    samples.className = "asset-font-samples";
    const fontFamily = `"${family}", sans-serif`;
    const pangrams = [
      ["Русская панграмма", "Съешь же ещё этих мягких французских булок, да выпей чаю."],
      ["Английская панграмма", "The quick brown fox jumps over the lazy dog."],
      ["Цифры и знаки", "0123456789  + - * / = < >  ( ) [ ] { }"]
    ];
    for (const [caption, text] of pangrams) {
      const sample = document.createElement("section");
      sample.className = "asset-font-sample";
      const heading = document.createElement("div");
      heading.className = "asset-font-sample-label";
      heading.textContent = caption;
      sample.appendChild(heading);
      const line = document.createElement("div");
      line.className = "asset-font-sample-text";
      line.style.fontFamily = fontFamily;
      line.textContent = text;
      sample.appendChild(line);
      samples.appendChild(sample);
    }
    content.appendChild(samples);
    const note = document.createElement("p");
    note.className = "asset-font-note";
    note.textContent = "Если в файле нет нужного символа, браузер может незаметно подставить его из запасного шрифта. То же с начертаниями «Ж» и «К»: когда в файле нет жирного или курсива, браузер имитирует их сам.";
    content.appendChild(note);
    return content;
  }
  var COLORS_CONSTANTS = {
    BLACK: "rgb(0, 0, 0)",
    WHITE: "rgb(255, 255, 255)",
    RED: "rgb(255, 0, 0)",
    GREEN: "rgb(0, 255, 0)",
    BLUE: "rgb(0, 0, 255)",
    YELLOW: "rgb(255, 255, 0)",
    CYAN: "rgb(0, 255, 255)",
    MAGENTA: "rgb(255, 0, 255)",
    GRAY: "rgb(128, 128, 128)",
    LIGHT_GRAY: "rgb(192, 192, 192)",
    DARK_RED: "rgb(128, 0, 0)",
    DARK_GREEN: "rgb(0, 128, 0)",
    DARK_BLUE: "rgb(0, 0, 128)",
    OLIVE: "rgb(128, 128, 0)",
    TEAL: "rgb(0, 128, 128)",
    PURPLE: "rgb(128, 0, 128)"
  };
  function parseColorsFactory(text) {
    const source = text.trim().replace(/;$/, "");
    const constant = /^colors\.([A-Z_]+)$/.exec(source);
    if (constant) return COLORS_CONSTANTS[constant[1]] ?? null;
    const call = /^colors\.(RGB|RGBA|HEX|HSL)\s*\(([^)]*)\)$/.exec(source);
    if (!call) return null;
    const kind = call[1];
    const rawArgs = call[2].split(",").map((item) => item.trim());
    const byte = (item) => {
      if (!/^\d{1,3}$/.test(item)) return null;
      const n = Number(item);
      return n <= 255 ? n : null;
    };
    if (kind === "RGB" && rawArgs.length === 3) {
      const [r, g, b] = rawArgs.map(byte);
      return r !== null && g !== null && b !== null ? `rgb(${r}, ${g}, ${b})` : null;
    }
    if (kind === "RGBA" && rawArgs.length === 4) {
      const [r, g, b] = rawArgs.slice(0, 3).map(byte);
      const alpha = /^(0|1|0?\.\d+|1\.0+)$/.test(rawArgs[3]) ? Number(rawArgs[3]) : null;
      return r !== null && g !== null && b !== null && alpha !== null && alpha <= 1 ? `rgba(${r}, ${g}, ${b}, ${alpha})` : null;
    }
    if (kind === "HEX" && rawArgs.length === 1) {
      const m = /^"#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})"$/.exec(rawArgs[0]);
      return m ? `#${m[1]}` : null;
    }
    if (kind === "HSL" && rawArgs.length === 3) {
      if (!rawArgs.every((item) => /^\d{1,3}$/.test(item))) return null;
      const [h, sPct, l] = rawArgs.map(Number);
      return h <= 360 && sPct <= 100 && l <= 100 ? `hsl(${h}, ${sPct}%, ${l}%)` : null;
    }
    return null;
  }
  window.__parseColorsFactory = parseColorsFactory;
  function isCurrentAssetPreview(file, preview, generation) {
    return generation === assetViewerGeneration && viewerHost.currentFile() === file && assetViewer && !assetViewer.hidden && assetViewer.contains(preview);
  }
  function releaseAssetViewerFont() {
    if (!activeAssetFontFace) return;
    if (document.fonts && typeof document.fonts.delete === "function") {
      document.fonts.delete(activeAssetFontFace);
    }
    activeAssetFontFace = null;
  }
  function releaseAssetViewerResources() {
    releaseAssetViewerFont();
    activeAssetImageCleanup?.();
    activeAssetImageCleanup = null;
  }
  function addAssetDetail(parent, label, value, warning = false) {
    const item = document.createElement("div");
    item.className = "asset-detail" + (warning ? " asset-detail-warning" : "");
    item.dataset.assetDetail = label;
    const term = document.createElement("dt");
    term.textContent = label;
    item.appendChild(term);
    const description = document.createElement("dd");
    description.textContent = value;
    item.appendChild(description);
    parent.appendChild(item);
  }
  function updateAssetDetail(parent, label, value) {
    for (const item of parent.querySelectorAll(".asset-detail")) {
      if (item.dataset.assetDetail !== label) continue;
      const description = item.querySelector("dd");
      if (description) description.textContent = value;
      return;
    }
  }

  // packages/web-ide/src/color-eyedropper.js
  function setupColorEyedropper(applyPickedColor) {
    const button = document.getElementById("color-eyedropper-button");
    if (!button) return;
    let active = false;
    let hookedDocuments = [];
    let lens = null;
    button.addEventListener("click", () => {
      active ? deactivateEyedropper() : activateEyedropper();
    });
    function activateEyedropper() {
      active = true;
      button.classList.add("eyedropper-active");
      const documents = [document];
      for (const frame of document.querySelectorAll("iframe")) {
        try {
          if (frame.contentDocument) documents.push(frame.contentDocument);
        } catch (_error) {
        }
      }
      hookedDocuments = documents.map((doc) => {
        const cursorStyle = doc.createElement("style");
        cursorStyle.textContent = "* { cursor: crosshair !important; pointer-events: auto !important; }\n#eyedropper-lens, #eyedropper-lens * { pointer-events: none !important; }";
        (doc.head || doc.documentElement).appendChild(cursorStyle);
        doc.addEventListener("mousedown", onEyedropperPress, true);
        doc.addEventListener("click", onEyedropperPick, true);
        doc.addEventListener("contextmenu", onEyedropperCancel, true);
        doc.addEventListener("keydown", onEyedropperKey, true);
        doc.addEventListener("mousemove", onEyedropperMove, true);
        return { doc, cursorStyle };
      });
      lens = document.createElement("div");
      lens.id = "eyedropper-lens";
      lens.hidden = true;
      const swatch = document.createElement("span");
      swatch.className = "eyedropper-lens-swatch";
      const label = document.createElement("span");
      label.className = "eyedropper-lens-label";
      lens.append(swatch, label);
      document.body.appendChild(lens);
    }
    function deactivateEyedropper() {
      active = false;
      button.classList.remove("eyedropper-active");
      for (const { doc, cursorStyle } of hookedDocuments) {
        try {
          cursorStyle.remove();
          doc.removeEventListener("mousedown", onEyedropperPress, true);
          doc.removeEventListener("click", onEyedropperPick, true);
          doc.removeEventListener("contextmenu", onEyedropperCancel, true);
          doc.removeEventListener("keydown", onEyedropperKey, true);
          doc.removeEventListener("mousemove", onEyedropperMove, true);
        } catch (_error) {
        }
      }
      hookedDocuments = [];
      if (lens) {
        lens.remove();
        lens = null;
      }
    }
    function onEyedropperMove(event) {
      if (!lens) return;
      const doc = event.target && event.target.ownerDocument || document;
      let pageX = event.clientX;
      let pageY = event.clientY;
      if (doc !== document) {
        try {
          const frame = doc.defaultView && doc.defaultView.frameElement;
          if (!frame) return;
          const rect = frame.getBoundingClientRect();
          pageX += rect.left + frame.clientLeft;
          pageY += rect.top + frame.clientTop;
        } catch (_error) {
          return;
        }
      }
      const picked = eyedropperColorAt(doc, event.clientX, event.clientY);
      lens.hidden = false;
      const flipX = pageX > window.innerWidth - 150;
      const flipY = pageY > window.innerHeight - 60;
      lens.style.left = `${pageX + (flipX ? -18 : 18)}px`;
      lens.style.top = `${pageY + (flipY ? -46 : 22)}px`;
      lens.style.transform = `translate(${flipX ? "-100%" : "0"}, 0)`;
      const swatch = lens.firstElementChild;
      const label = lens.lastElementChild;
      if (picked) {
        swatch.style.background = `rgb(${picked.red}, ${picked.green}, ${picked.blue})`;
        label.textContent = `${picked.red}, ${picked.green}, ${picked.blue}`;
      } else {
        swatch.style.background = "transparent";
        label.textContent = "—";
      }
    }
    function eyedropperTargetsButton(event) {
      const target = event.target;
      return Boolean(target && typeof target.closest === "function" && target.closest("#color-eyedropper-button"));
    }
    function onEyedropperPress(event) {
      if (eyedropperTargetsButton(event)) return;
      event.preventDefault();
      event.stopPropagation();
    }
    function onEyedropperPick(event) {
      if (eyedropperTargetsButton(event)) return;
      event.preventDefault();
      event.stopPropagation();
      const doc = event.target && event.target.ownerDocument || document;
      const picked = eyedropperColorAt(doc, event.clientX, event.clientY);
      if (picked) {
        applyPickedColor(picked);
      }
      deactivateEyedropper();
    }
    function onEyedropperCancel(event) {
      event.preventDefault();
      event.stopPropagation();
      deactivateEyedropper();
    }
    function onEyedropperKey(event) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      deactivateEyedropper();
    }
  }
  function eyedropperColorAt(doc, x, y) {
    const layers = [];
    collectEyedropperLayers(doc, x, y, layers);
    if (layers.length === 0) return null;
    let red = 0;
    let green = 0;
    let blue = 0;
    let alpha = 0;
    for (const layer of layers) {
      const weight = layer.alpha * (1 - alpha);
      red += layer.red * weight;
      green += layer.green * weight;
      blue += layer.blue * weight;
      alpha += weight;
      if (alpha >= 0.999) break;
    }
    if (alpha <= 0) return null;
    return { red: Math.round(red / alpha), green: Math.round(green / alpha), blue: Math.round(blue / alpha), alpha };
  }
  function collectEyedropperLayers(doc, x, y, layers) {
    const view = doc.defaultView || window;
    const textLayer = eyedropperTextAt(doc, x, y);
    if (textLayer) layers.push(textLayer);
    const stack = doc.elementsFromPoint(x, y);
    for (const el of stack) {
      if (el.id === "eyedropper-lens" || typeof el.closest === "function" && el.closest("#eyedropper-lens")) continue;
      const tag = el.tagName;
      if (tag === "IFRAME") {
        try {
          if (el.contentDocument) {
            const rect = el.getBoundingClientRect();
            collectEyedropperLayers(el.contentDocument, x - rect.left - el.clientLeft, y - rect.top - el.clientTop, layers);
          }
        } catch (_error) {
        }
        continue;
      }
      if (tag === "IMG" || tag === "CANVAS") {
        const pixel = eyedropperPixelFrom(el, x, y);
        if (pixel && pixel.alpha > 0) {
          layers.push(pixel);
          if (pixel.alpha >= 1) return;
        }
      }
      const style = view.getComputedStyle(el);
      for (const gradient of parseCssGradients(style.backgroundImage)) {
        const rect = el.getBoundingClientRect();
        const layer = sampleLinearGradient(gradient, rect, x, y);
        if (layer && layer.alpha > 0) {
          layers.push(layer);
          if (layer.alpha >= 1) return;
        }
      }
      const background = parseCssColor(style.backgroundColor);
      if (background && background.alpha > 0) {
        layers.push(background);
        if (background.alpha >= 1) return;
      }
    }
  }
  function eyedropperTextAt(doc, x, y) {
    try {
      let node = null;
      let offset = 0;
      if (typeof doc.caretPositionFromPoint === "function") {
        const position = doc.caretPositionFromPoint(x, y);
        if (position) {
          node = position.offsetNode;
          offset = position.offset;
        }
      } else if (typeof doc.caretRangeFromPoint === "function") {
        const range = doc.caretRangeFromPoint(x, y);
        if (range) {
          node = range.startContainer;
          offset = range.startOffset;
        }
      }
      if (!node || node.nodeType !== 3 || !node.parentElement) return null;
      const text = node.textContent;
      if (!text) return null;
      for (const from of [offset - 1, offset]) {
        if (from < 0 || from >= text.length) continue;
        if (!text.slice(from, from + 1).trim()) continue;
        const probe = doc.createRange();
        probe.setStart(node, from);
        probe.setEnd(node, from + 1);
        const rect = probe.getBoundingClientRect();
        if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) continue;
        const view = doc.defaultView || window;
        const color = parseCssColor(view.getComputedStyle(node.parentElement).color);
        return color && color.alpha > 0 ? color : null;
      }
      return null;
    } catch (_error) {
      return null;
    }
  }
  function eyedropperPixelFrom(el, x, y) {
    try {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return null;
      const sourceWidth = el.tagName === "IMG" ? el.naturalWidth : el.width;
      const sourceHeight = el.tagName === "IMG" ? el.naturalHeight : el.height;
      if (!sourceWidth || !sourceHeight) return null;
      let box = { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
      if (el.tagName === "IMG") {
        const view = el.ownerDocument && el.ownerDocument.defaultView || window;
        const fit = view.getComputedStyle(el).objectFit;
        if (fit === "contain" || fit === "cover" || fit === "scale-down") {
          const cover = fit === "cover";
          let scale = cover ? Math.max(rect.width / sourceWidth, rect.height / sourceHeight) : Math.min(rect.width / sourceWidth, rect.height / sourceHeight);
          if (fit === "scale-down") scale = Math.min(scale, 1);
          const boxWidth = sourceWidth * scale;
          const boxHeight = sourceHeight * scale;
          box = {
            left: rect.left + (rect.width - boxWidth) / 2,
            top: rect.top + (rect.height - boxHeight) / 2,
            width: boxWidth,
            height: boxHeight
          };
          if (x < box.left || x > box.left + box.width || y < box.top || y > box.top + box.height) return null;
        }
      }
      const px = clamp(Math.floor((x - box.left) / box.width * sourceWidth), 0, sourceWidth - 1);
      const py = clamp(Math.floor((y - box.top) / box.height * sourceHeight), 0, sourceHeight - 1);
      const probe = document.createElement("canvas");
      probe.width = 1;
      probe.height = 1;
      const context = probe.getContext("2d", { willReadFrequently: true });
      context.drawImage(el, px, py, 1, 1, 0, 0, 1, 1);
      const data = context.getImageData(0, 0, 1, 1).data;
      if (data[3] === 0) return null;
      return { red: data[0], green: data[1], blue: data[2], alpha: data[3] / 255 };
    } catch (_error) {
      return null;
    }
  }
  function parseCssGradients(backgroundImage) {
    if (typeof backgroundImage !== "string" || !backgroundImage.includes("linear-gradient(")) return [];
    const gradients = [];
    let index = 0;
    while ((index = backgroundImage.indexOf("linear-gradient(", index)) !== -1) {
      let depth = 0;
      let end = index + "linear-gradient(".length - 1;
      for (let i = end; i < backgroundImage.length; i += 1) {
        if (backgroundImage[i] === "(") depth += 1;
        if (backgroundImage[i] === ")") {
          depth -= 1;
          if (depth === 0) {
            end = i;
            break;
          }
        }
      }
      const body = backgroundImage.slice(index + "linear-gradient(".length, end);
      const gradient = parseLinearGradientBody(body);
      if (gradient) gradients.push(gradient);
      index = end + 1;
    }
    return gradients;
  }
  function parseLinearGradientBody(body) {
    const parts = [];
    let depth = 0;
    let current = "";
    for (const ch of body) {
      if (ch === "(") depth += 1;
      if (ch === ")") depth -= 1;
      if (ch === "," && depth === 0) {
        parts.push(current.trim());
        current = "";
        continue;
      }
      current += ch;
    }
    if (current.trim()) parts.push(current.trim());
    if (parts.length === 0) return null;
    let direction = "to bottom";
    if (/^to |^-?[\d.]+deg$/u.test(parts[0])) direction = parts.shift();
    if (parts.length < 2) return null;
    const stops = [];
    for (const part of parts) {
      const positionMatch = /^(.*?)\s+([\d.]+)%$/u.exec(part);
      const color = parseCssColor(positionMatch ? positionMatch[1] : part);
      if (!color) return null;
      stops.push({ color, position: positionMatch ? Number(positionMatch[2]) / 100 : null });
    }
    if (stops[0].position === null) stops[0].position = 0;
    if (stops[stops.length - 1].position === null) stops[stops.length - 1].position = 1;
    for (let i = 1; i < stops.length - 1; i += 1) {
      if (stops[i].position === null) {
        let next = i;
        while (stops[next].position === null) next += 1;
        const prev = stops[i - 1].position;
        stops[i].position = prev + (stops[next].position - prev) / (next - i + 1);
      }
    }
    return { direction, stops };
  }
  function sampleLinearGradient(gradient, rect, x, y) {
    if (rect.width === 0 || rect.height === 0) return null;
    let fraction;
    const d = gradient.direction;
    if (d === "to right" || d === "90deg") fraction = (x - rect.left) / rect.width;
    else if (d === "to left" || d === "270deg" || d === "-90deg") fraction = (rect.right - x) / rect.width;
    else if (d === "to top" || d === "0deg") fraction = (rect.bottom - y) / rect.height;
    else if (d === "to bottom" || d === "180deg") fraction = (y - rect.top) / rect.height;
    else {
      const degMatch = /^(-?[\d.]+)deg$/u.exec(d);
      if (!degMatch) return null;
      const deg = (Number(degMatch[1]) % 360 + 360) % 360;
      if (deg < 45 || deg >= 315) fraction = (rect.bottom - y) / rect.height;
      else if (deg < 135) fraction = (x - rect.left) / rect.width;
      else if (deg < 225) fraction = (y - rect.top) / rect.height;
      else fraction = (rect.right - x) / rect.width;
    }
    fraction = clamp(fraction, 0, 1);
    const stops = gradient.stops;
    if (fraction <= stops[0].position) return { ...stops[0].color };
    if (fraction >= stops[stops.length - 1].position) return { ...stops[stops.length - 1].color };
    for (let i = 1; i < stops.length; i += 1) {
      if (fraction <= stops[i].position) {
        const span2 = stops[i].position - stops[i - 1].position;
        const t = span2 === 0 ? 0 : (fraction - stops[i - 1].position) / span2;
        const a = stops[i - 1].color;
        const b = stops[i].color;
        return {
          red: Math.round(a.red + (b.red - a.red) * t),
          green: Math.round(a.green + (b.green - a.green) * t),
          blue: Math.round(a.blue + (b.blue - a.blue) * t),
          alpha: a.alpha + (b.alpha - a.alpha) * t
        };
      }
    }
    return null;
  }
  function parseCssColor(text) {
    if (typeof text !== "string") return null;
    const match = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/u.exec(text.trim());
    if (!match) return null;
    return {
      red: clamp(Number(match[1]), 0, 255),
      green: clamp(Number(match[2]), 0, 255),
      blue: clamp(Number(match[3]), 0, 255),
      alpha: match[4] === void 0 ? 1 : clamp(Number(match[4]), 0, 1)
    };
  }

  // packages/web-ide/src/console-output.js
  function setOutputText(text, className = "", options = {}) {
    output.replaceChildren();
    if (!className) {
      if (options.ansi) {
        appendAnsiText(output, text);
      } else {
        output.textContent = text;
      }
      return;
    }
    const span2 = document.createElement("span");
    span2.className = className;
    span2.textContent = text;
    output.appendChild(span2);
  }
  function appendRuntimeWarnings(runtime) {
    if (!runtime || typeof runtime.collectProgramEndWarnings !== "function") return;
    try {
      for (const warning of runtime.collectProgramEndWarnings()) {
        appendOutput(warning, "output-warning");
      }
    } catch (_error) {
    }
  }
  async function appendExitLine(runtime) {
    if (!runtime || typeof runtime.getExitText !== "function") return;
    const text = await runtime.getExitText();
    if (text === null) return;
    appendOutput(`[Программа завершилась с кодом ${text}]`, "output-muted");
  }
  function appendOutput(text, className = "", options = {}) {
    if (output.textContent) output.appendChild(document.createTextNode("\n"));
    if (!className) {
      if (options.ansi) {
        appendAnsiText(output, text);
      } else {
        output.appendChild(document.createTextNode(text));
      }
      return;
    }
    const span2 = document.createElement("span");
    span2.className = className;
    span2.textContent = text;
    output.appendChild(span2);
  }
  function setStatus(text, isError = false) {
    if (!status) return;
    status.textContent = text;
    status.classList.toggle("error", isError);
  }

  // packages/web-ide/src/run-preview.js
  var runHost = {
    saveCurrentEditor: () => {
    },
    hideCompletions: () => {
    },
    getEditorValue: () => "",
    setEditorValue: (_value, _file) => {
    },
    isEditorReadOnly: () => false,
    updateEditorVisuals: () => {
    },
    editorReady: () => false,
    scheduleAutosave: () => {
    },
    renderFiles: () => {
    },
    addProjectFolder: (_path) => {
    },
    setProjectFile: (_path, _item) => {
    },
    removeProjectItem: (_path, _type) => {
    },
    fallbackFilePath: () => MAIN_FILE,
    resetToFallbackFile: () => {
    },
    applyPreviewTheme: () => {
    },
    folders: null
  };
  function registerRunHost(host) {
    Object.assign(runHost, host);
  }
  var currentRuntime = null;
  var guiTimer = null;
  var lastTick = Date.now();
  var guiBusy = false;
  var pendingGuiEvents = [];
  var guiFrameReady = false;
  var pendingSnapshot = null;
  var runAbortController = null;
  var programRunning = false;
  var currentRuntimeFileSnapshot = null;
  var outputSyncTimer = null;
  var runSequence = 0;
  var previewGeneration = 0;
  var pendingConsoleInput = null;
  var consoleInputEchoes = [];
  var lastSnapshotJson = "";
  var lastRenderedRuntimeOutput = null;
  var previewTargetOrigin = window.location.origin && window.location.origin !== "null" ? window.location.origin : "*";
  function markGuiFrameReady() {
    guiFrameReady = true;
    lastSnapshotJson = "";
    runHost.applyPreviewTheme();
    if (pendingSnapshot) postSnapshot(pendingSnapshot);
  }
  var rehearsalServers = /* @__PURE__ */ new Map();
  var rehearsalWorkerPromise = null;
  function ensureRehearsalWorker() {
    if (!rehearsalWorkerPromise) {
      rehearsalWorkerPromise = (async () => {
        if (!("serviceWorker" in navigator)) return null;
        const siteVersion = await fetch("version.json").then((response) => response.ok ? response.json() : null).then((data) => data && data.version ? String(data.version) : "").catch(() => "");
        const registration = await navigator.serviceWorker.register(siteVersion ? `sw-preview.js?v=${siteVersion}` : "sw-preview.js");
        await navigator.serviceWorker.ready;
        const worker = registration.active;
        if (!worker) return null;
        const ack = await new Promise((resolve) => {
          const channel = new MessageChannel();
          const timer = setTimeout(() => resolve(null), 3e3);
          channel.port1.onmessage = (event) => {
            clearTimeout(timer);
            resolve(event.data);
          };
          worker.postMessage({ type: "idyllium-host-register" }, [channel.port2]);
        });
        return ack && ack.ok ? registration : null;
      })().catch(() => null);
    }
    return rehearsalWorkerPromise;
  }
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("message", (event) => {
      const data = event.data || {};
      const replyPort = event.ports[0];
      if (!replyPort) return;
      if (data.type === "idyllium-host-query") {
        replyPort.postMessage({ host: rehearsalServers.size > 0 });
        return;
      }
      if (data.type === "idyllium-preview-request") {
        const handler = rehearsalServers.get(data.port);
        if (!handler) {
          replyPort.postMessage({ error: "no-server" });
          return;
        }
        Promise.resolve(handler(data.request)).then(
          (response) => replyPort.postMessage({ response }),
          (error) => replyPort.postMessage({
            response: {
              status: 500,
              headers: { "content-type": "text/plain; charset=utf-8" },
              body: String(error && error.message || error)
            }
          })
        );
      }
    });
  }
  window.__rehearsalPorts = () => [...rehearsalServers.keys()];
  async function browserNetworkListen(options, handler) {
    const registration = await ensureRehearsalWorker();
    if (!registration) {
      throw new Error("the rehearsal server needs a Service Worker, and this browser window does not allow it — run the program in VS Code or the console host");
    }
    let port = options.port;
    if (port === 0) {
      port = 8080;
      while (rehearsalServers.has(port)) port += 1;
    }
    if (rehearsalServers.has(port)) {
      const busy = new Error(`port ${port} is already in use`);
      busy.code = "EADDRINUSE";
      throw busy;
    }
    rehearsalServers.set(port, handler);
    const scopePath = new URL(registration.scope).pathname;
    const address = `${location.origin}${scopePath}preview/${port}/`;
    return {
      port,
      announce: `Сервер-репетиция запущена: ${address} — сайт видит только этот браузер; настоящий сервер программа поднимет в VS Code или консоли`,
      close() {
        rehearsalServers.delete(port);
      }
    };
  }
  async function runProgram() {
    if (!runnableFileIsOpen()) {
      setStatus(`«${shortFileName(viewerHost.currentFile())}» — не программа: запускается открытый файл .idyl`, true);
      return;
    }
    stopProgram(true);
    const runId = ++runSequence;
    previewGeneration++;
    runHost.saveCurrentEditor();
    runHost.hideCompletions();
    output.textContent = "";
    consoleInputEchoes = [];
    lastRenderedRuntimeOutput = "";
    lastSnapshotJson = "";
    const controller = new AbortController();
    runAbortController = controller;
    setRunControls(true);
    setStatus("Запуск...");
    postEmptySnapshot();
    try {
      const prepared = await window.Idyllium.prepareIdylliumBrowserProgram({
        entryFile: viewerHost.currentFile(),
        files: browserFiles(),
        abortSignal: controller.signal,
        networkListen: browserNetworkListen,
        console: {
          clear() {
            consoleInputEchoes = [];
            output.replaceChildren();
            lastRenderedRuntimeOutput = "";
          },
          async readLine() {
            return requestConsoleInput(controller.signal);
          }
        }
      });
      if (runId !== runSequence) return;
      if (!prepared.compilation.success || !prepared.runtime) {
        setOutputText(formatDiagnosticText(prepared.compilation.diagnosticsText), "output-error");
        setStatus("Ошибка компиляции", true);
        runAbortController = null;
        currentRuntimeFileSnapshot = null;
        setRunControls(false);
        return;
      }
      if (!prepared.compilation.ast?.main) {
        setOutputText(`В файле «${shortFileName(viewerHost.currentFile())}» нет функции main() — запускать нечего.`, "output-error");
        setStatus("Нет main()", true);
        runAbortController = null;
        currentRuntimeFileSnapshot = null;
        setRunControls(false);
        return;
      }
      currentRuntime = prepared.runtime;
      currentRuntimeFileSnapshot = prepared.writtenFilesSnapshot;
      startOutputSync();
      let exitedEarly = false;
      await runRuntimeActionWithSnapshotPump(async () => {
        try {
          await prepared.run();
        } catch (error) {
          if (error?.kind !== "exit") throw error;
          exitedEarly = true;
        }
      });
      if (runId !== runSequence) return;
      syncRuntimeFilesFromSnapshot();
      syncRuntimeOutput();
      sendRuntimeSnapshot();
      if (runtimeHasGui(currentRuntime) && !exitedEarly) {
        startGuiLoop();
        setRunControls(false, true);
      } else {
        stopOutputSync();
        postEmptySnapshot();
        if (!output.textContent) output.textContent = "Программа Idyllium успешно завершилась.";
        appendRuntimeWarnings(currentRuntime);
        await appendExitLine(currentRuntime);
        runAbortController = null;
        setRunControls(false);
      }
      setStatus("Готово");
    } catch (error) {
      if (runId !== runSequence) return;
      syncRuntimeOutput();
      syncRuntimeFilesFromSnapshot();
      stopOutputSync();
      const wasStopped = controller.signal.aborted;
      appendOutput(formatThrownError(error), wasStopped ? "output-soft-error" : "output-error");
      setStatus(wasStopped ? "Остановлено" : "Ошибка запуска", !wasStopped);
      currentRuntime = null;
      currentRuntimeFileSnapshot = null;
      postEmptySnapshot();
    }
    if (!runtimeHasGui(currentRuntime)) {
      runAbortController = null;
      currentRuntimeFileSnapshot = null;
      setRunControls(false);
    }
  }
  function stopProgram(silent = false) {
    const hadRuntime = Boolean(currentRuntime || runAbortController);
    if (hadRuntime) {
      runSequence++;
      previewGeneration++;
      lastSnapshotJson = "";
    }
    if (runAbortController && !runAbortController.signal.aborted) runAbortController.abort();
    syncRuntimeFilesFromSnapshot();
    stopOutputSync();
    stopGuiLoop();
    pendingGuiEvents.length = 0;
    clearPendingConsoleInput();
    currentRuntime = null;
    currentRuntimeFileSnapshot = null;
    runAbortController = null;
    postEmptySnapshot();
    setRunControls(false);
    if (!silent && hadRuntime) {
      appendOutput("Приложение остановлено пользователем", "output-soft-error");
      setStatus("Остановлено");
    }
  }
  function setRunControls(active, keepStopAvailable = false) {
    programRunning = active;
    stopButton.disabled = !(active || keepStopAvailable);
    updateRunButton();
  }
  function runnableFileIsOpen() {
    const item = files.get(viewerHost.currentFile());
    return Boolean(item && item.kind === "text" && viewerHost.currentFile().endsWith(".idyl"));
  }
  function updateRunButton() {
    const runnable = runnableFileIsOpen();
    runButton.disabled = programRunning || !runnable;
    const title = runnable || programRunning ? "Запустить: Ctrl+Enter" : "Запускается открытый файл .idyl — откройте программу";
    runButton.title = title;
    runButton.setAttribute("aria-label", title);
  }
  function startOutputSync() {
    stopOutputSync();
    syncRuntimeOutput();
    outputSyncTimer = window.setInterval(syncRuntimeOutput, 100);
  }
  function stopOutputSync() {
    if (outputSyncTimer !== null) window.clearInterval(outputSyncTimer);
    outputSyncTimer = null;
  }
  function syncRuntimeOutput() {
    if (!currentRuntime) return;
    const rendered = renderRuntimeOutput(currentRuntime.getOutput());
    if (rendered === lastRenderedRuntimeOutput) return;
    lastRenderedRuntimeOutput = rendered;
    setOutputText(rendered, "", { ansi: true });
  }
  function syncRuntimeFilesFromSnapshot() {
    if (typeof currentRuntimeFileSnapshot !== "function") return false;
    const snapshot = currentRuntimeFileSnapshot() || {};
    let changed = false;
    let currentFileChanged = false;
    let currentFileDeleted = false;
    for (const [rawPath, rawEntry] of Object.entries(snapshot)) {
      const path = normalizeWorkspacePath(rawPath);
      if (path === WORKSPACE_ROOT) continue;
      const entry = typeof rawEntry === "string" ? { kind: "file", content: rawEntry, resourceUri: "" } : rawEntry || {};
      if (entry.kind === "deleted") {
        if (runHost.folders.has(path)) {
          if (viewerHost.currentFile() === path || viewerHost.currentFile().startsWith(path + "/")) currentFileDeleted = true;
          runHost.removeProjectItem(path, "folder");
          changed = true;
        } else if (files.has(path)) {
          if (viewerHost.currentFile() === path) currentFileDeleted = true;
          runHost.removeProjectItem(path, "file");
          changed = true;
        }
        continue;
      }
      if (entry.kind === "directory") {
        if (!runHost.folders.has(path)) {
          runHost.addProjectFolder(path);
          changed = true;
        }
        continue;
      }
      if (entry.bytes instanceof Uint8Array) {
        const bytes = new Uint8Array(entry.bytes);
        const resourceUri = entry.resourceUri || bytesToDataUrl(path, bytes);
        const previous2 = files.get(path);
        const sameBytes = previous2?.kind === "asset" && equalBytes(previous2.bytes, bytes);
        if (!sameBytes || previous2.resourceUri !== resourceUri) {
          runHost.setProjectFile(path, { kind: "asset", content: "", bytes, resourceUri });
          changed = true;
          if (path === viewerHost.currentFile()) currentFileChanged = true;
        }
        continue;
      }
      const content = typeof entry.content === "string" ? entry.content : "";
      const previous = files.get(path);
      if (!previous || previous.kind !== "text" || previous.content !== content) {
        runHost.setProjectFile(path, { kind: "text", content });
        changed = true;
        if (path === viewerHost.currentFile()) currentFileChanged = true;
      }
    }
    if (!changed) return false;
    if (currentFileDeleted || !files.has(viewerHost.currentFile())) {
      if (files.size === 0) runHost.setProjectFile(MAIN_FILE, { kind: "text", content: "" });
      runHost.resetToFallbackFile();
    } else if (currentFileChanged) {
      const item = files.get(viewerHost.currentFile());
      if (item && item.kind === "text") {
        runHost.setEditorValue(item.content || "", viewerHost.currentFile());
        runHost.updateEditorVisuals();
        if (isCsvFile(viewerHost.currentFile()) && structuredViewModes.get(viewerHost.currentFile()) === "table") {
          csvViewer.replaceChildren();
          renderCsvTable(viewerHost.currentFile(), item.content || "");
        } else if (isJsonFile(viewerHost.currentFile()) && structuredViewModes.get(viewerHost.currentFile()) === "tree") {
          jsonViewer.replaceChildren();
          renderJsonTree(viewerHost.currentFile(), item.content || "");
        }
      } else if (item && item.kind === "asset") {
        showAssetViewer(viewerHost.currentFile(), item);
      }
    }
    runHost.renderFiles();
    runHost.scheduleAutosave();
    return true;
  }
  function equalBytes(left, right) {
    if (!(left instanceof Uint8Array) || !(right instanceof Uint8Array) || left.length !== right.length) return false;
    for (let index = 0; index < left.length; index++) {
      if (left[index] !== right[index]) return false;
    }
    return true;
  }
  function renderRuntimeOutput(runtimeOutput) {
    if (consoleInputEchoes.length === 0) return runtimeOutput;
    let rendered = "";
    let cursor = 0;
    const echoes = [...consoleInputEchoes].sort((left, right) => left.offset === right.offset ? left.order - right.order : left.offset - right.offset);
    for (const echo of echoes) {
      const offset = clamp(echo.offset, cursor, runtimeOutput.length);
      rendered += runtimeOutput.slice(cursor, offset) + echo.text;
      cursor = offset;
    }
    return rendered + runtimeOutput.slice(cursor);
  }
  function runtimeHasGui(runtime) {
    if (runtime && typeof runtime.hasGui === "function") return runtime.hasGui();
    return Boolean(runtime && (runtime.getWindows().length > 0 || runtime.getCanvases().length > 0 || runtime.getModals().length > 0 || runtimeHasActiveAudio(runtime)));
  }
  function runtimeHasActiveAudio(runtime) {
    if (!runtime || typeof runtime.getAudio !== "function") return false;
    return runtime.getAudio().some((item) => item && item.properties && item.properties.is_playing === true);
  }
  function requestConsoleInput(signal) {
    if (signal.aborted) return Promise.reject(new Error("program was stopped"));
    if (pendingConsoleInput) {
      pendingConsoleInput.reject(new Error("program was stopped"));
      clearPendingConsoleInput();
    }
    consoleInput.value = "";
    consoleInputPanel.hidden = false;
    window.setTimeout(() => consoleInput.focus(), 0);
    return new Promise((resolve, reject) => {
      const onAbort = () => {
        reject(new Error("program was stopped"));
        clearPendingConsoleInput();
      };
      pendingConsoleInput = {
        resolve,
        reject,
        onAbort,
        signal,
        outputOffset: currentRuntime ? currentRuntime.getOutput().length : 0
      };
      signal.addEventListener("abort", onAbort, { once: true });
    });
  }
  function submitConsoleInput() {
    if (!pendingConsoleInput) return;
    const value = consoleInput.value;
    const pending = pendingConsoleInput;
    consoleInputEchoes.push({
      offset: pending.outputOffset,
      order: consoleInputEchoes.length,
      text: value + "\n"
    });
    clearPendingConsoleInput();
    syncRuntimeOutput();
    pending.resolve(value);
  }
  function clearPendingConsoleInput() {
    if (pendingConsoleInput) {
      pendingConsoleInput.signal.removeEventListener("abort", pendingConsoleInput.onAbort);
    }
    pendingConsoleInput = null;
    consoleInput.value = "";
    consoleInputPanel.hidden = true;
  }
  function formatCurrentFile() {
    if (!viewerHost.currentFile().endsWith(".idyl") || runHost.isEditorReadOnly()) {
      setStatus("Форматирование доступно только для .idyl", true);
      return;
    }
    const formatted = window.Idyllium.formatIdyllium(runHost.getEditorValue());
    runHost.setEditorValue(formatted, viewerHost.currentFile());
    runHost.saveCurrentEditor();
    runHost.updateEditorVisuals();
    setStatus("Код отформатирован");
  }
  function browserFiles() {
    refreshBrowserAssetUrls();
    const result = {};
    for (const folder of runHost.folders) {
      result[folder] = { kind: "directory" };
    }
    for (const [file, item] of files) {
      result[file] = item.kind === "asset" ? {
        content: item.content || "",
        bytes: item.bytes instanceof Uint8Array ? new Uint8Array(item.bytes) : void 0,
        resourceUri: browserAssetResourceUri(file, item)
      } : item.content;
    }
    return result;
  }
  function refreshBrowserAssetUrls() {
    for (const [path, cached] of browserAssetUrls) {
      if (files.get(path) === cached.item) continue;
      URL.revokeObjectURL(cached.url);
      browserAssetUrls.delete(path);
    }
  }
  function browserAssetResourceUri(path, item) {
    const cached = browserAssetUrls.get(path);
    if (cached && cached.item === item) return cached.url;
    if (cached) URL.revokeObjectURL(cached.url);
    const bytes = assetBytes(item);
    if (bytes.length === 0) return item.resourceUri || "";
    const type = detectAssetMimeType(path, bytes);
    const url = URL.createObjectURL(new Blob([bytes], { type }));
    browserAssetUrls.set(path, { item, url });
    return url;
  }
  function revokeAllBrowserAssetUrls() {
    for (const cached of browserAssetUrls.values()) URL.revokeObjectURL(cached.url);
    browserAssetUrls.clear();
  }
  function textSourceMap() {
    const result = /* @__PURE__ */ new Map();
    for (const [file, item] of files) {
      if (item.kind === "text" && file.endsWith(".idyl")) result.set(file, item.content);
    }
    return result;
  }
  async function enqueueGuiEvent(message) {
    if (!message || message.type !== "guiEvent") return;
    pendingGuiEvents.push(message);
    await drainGuiEvents();
  }
  function reportGuiEventFailure(error) {
    syncRuntimeOutput();
    syncRuntimeFilesFromSnapshot();
    appendOutput(formatThrownError(error), "output-error");
    setStatus("Ошибка события GUI", true);
  }
  async function drainGuiEvents() {
    if (!currentRuntime || guiBusy) return;
    guiBusy = true;
    try {
      while (currentRuntime && pendingGuiEvents.length > 0) {
        const message = pendingGuiEvents.shift();
        await runRuntimeActionWithSnapshotPump(async () => {
          await currentRuntime.dispatchGuiEvent(Number(message.objectId), String(message.eventName), message.payload || {});
        });
      }
    } finally {
      guiBusy = false;
    }
  }
  function runRuntimeActionWithSnapshotPump(action) {
    return window.Idyllium.runActionWithSnapshotPump(action, () => {
      syncRuntimeOutput();
      syncRuntimeFilesFromSnapshot();
      sendRuntimeSnapshot();
    });
  }
  function startGuiLoop() {
    if (!currentRuntime) return;
    lastTick = Date.now();
    const intervalMs = guiLoopIntervalMs(currentRuntime);
    guiTimer = window.setInterval(async () => {
      if (!currentRuntime || guiBusy) return;
      guiBusy = true;
      try {
        const now = Date.now();
        const delta = Math.max(0, (now - lastTick) / 1e3);
        lastTick = now;
        const changed = await currentRuntime.stepGui(delta);
        syncRuntimeOutput();
        syncRuntimeFilesFromSnapshot();
        if (changed) sendRuntimeSnapshot();
        if (!runtimeHasGui(currentRuntime)) {
          finishCompletedRuntime();
        }
      } catch (error) {
        syncRuntimeOutput();
        syncRuntimeFilesFromSnapshot();
        stopOutputSync();
        appendOutput(formatThrownError(error), "output-error");
        setStatus("Ошибка GUI-шага", true);
        stopGuiLoop();
        currentRuntime = null;
        runAbortController = null;
        setRunControls(false);
        postEmptySnapshot();
      } finally {
        guiBusy = false;
        if (pendingGuiEvents.length > 0) void drainGuiEvents().catch(reportGuiEventFailure);
      }
    }, intervalMs);
  }
  function stopGuiLoop() {
    if (guiTimer !== null) window.clearInterval(guiTimer);
    guiTimer = null;
  }
  function finishCompletedRuntime() {
    stopOutputSync();
    stopGuiLoop();
    const finishedRuntime = currentRuntime;
    currentRuntime = null;
    currentRuntimeFileSnapshot = null;
    runAbortController = null;
    setRunControls(false);
    if (!output.textContent) output.textContent = "Программа Idyllium успешно завершилась.";
    appendRuntimeWarnings(finishedRuntime);
    void appendExitLine(finishedRuntime);
    setStatus("Готово");
    postEmptySnapshot();
  }
  function sendRuntimeSnapshot() {
    if (!currentRuntime) {
      postEmptySnapshot();
      return;
    }
    const windows = currentRuntime.getWindows();
    postSnapshot({
      audio: currentRuntime.getAudio ? currentRuntime.getAudio() : [],
      windows,
      canvases: windows.length > 0 ? [] : currentRuntime.getCanvases(),
      modals: currentRuntime.getModals(),
      output: ""
    });
  }
  function guiLoopIntervalMs(runtime) {
    return window.Idyllium.guiPreviewIntervalMs(runtime.getWindows(), runtime.getCanvases());
  }
  function postEmptySnapshot() {
    postSnapshot({ audio: [], windows: [], canvases: [], modals: [], output: "" });
  }
  function postSnapshot(snapshot) {
    const fullSnapshot = {
      ...snapshot,
      generation: previewGeneration
    };
    pendingSnapshot = fullSnapshot;
    if (!guiFrameReady || !guiFrame.contentWindow) return;
    const snapshotJson = JSON.stringify(fullSnapshot);
    if (snapshotJson === lastSnapshotJson) return;
    lastSnapshotJson = snapshotJson;
    guiFrame.contentWindow.postMessage({
      type: "snapshot",
      generation: fullSnapshot.generation,
      audio: fullSnapshot.audio || [],
      windows: fullSnapshot.windows,
      canvases: fullSnapshot.canvases,
      modals: fullSnapshot.modals,
      output: fullSnapshot.output
    }, previewTargetOrigin);
  }
  var browserAssetUrls = /* @__PURE__ */ new Map();

  // packages/web-ide/src/monaco-lang.js
  var MONACO_LANGUAGE_ID = "idyllium";
  var SEMANTIC_TOKEN_TYPES = [...window.Idyllium.IDYLLIUM_SEMANTIC_TOKEN_TYPES];
  var SEMANTIC_TOKEN_MODIFIERS = [...window.Idyllium.IDYLLIUM_SEMANTIC_TOKEN_MODIFIERS];
  function registerMonacoIdyllium() {
    const monaco = window.monaco;
    if (!monaco || monaco.languages.getLanguages().some((language) => language.id === MONACO_LANGUAGE_ID)) return;
    monaco.languages.register({
      id: MONACO_LANGUAGE_ID,
      extensions: [".idyl"],
      aliases: ["Idyllium", "idyllium"]
    });
    monaco.languages.setLanguageConfiguration(MONACO_LANGUAGE_ID, {
      comments: { lineComment: "//" },
      brackets: [["{", "}"], ["[", "]"], ["(", ")"]],
      autoClosingPairs: [
        { open: "{", close: "}" },
        { open: "[", close: "]" },
        { open: "(", close: ")" },
        { open: '"', close: '"', notIn: ["string"] },
        { open: "'", close: "'", notIn: ["string", "comment"] }
      ],
      surroundingPairs: [
        { open: "{", close: "}" },
        { open: "[", close: "]" },
        { open: "(", close: ")" },
        { open: '"', close: '"' },
        { open: "'", close: "'" }
      ],
      indentationRules: {
        increaseIndentPattern: /^.*\{\s*(?:\/\/.*)?$/u,
        decreaseIndentPattern: /^\s*\}/u
      },
      onEnterRules: [
        {
          beforeText: /^.*\{\s*$/u,
          afterText: /^\s*\}/u,
          action: { indentAction: monaco.languages.IndentAction.IndentOutdent }
        },
        {
          beforeText: /^.*\{\s*$/u,
          action: { indentAction: monaco.languages.IndentAction.Indent }
        }
      ],
      wordPattern: /[A-Za-z_А-Яа-яЁё][A-Za-z0-9_А-Яа-яЁё]*/u
    });
    monaco.languages.setMonarchTokensProvider(MONACO_LANGUAGE_ID, {
      keywords: [...KEYWORDS],
      builtinTypes: [...BUILTIN_TYPES],
      classNames: [...CLASS_NAMES],
      qualifiedTypes: [...QUALIFIED_TYPES],
      tokenizer: {
        root: [
          [/\/\/.*$/u, "comment"],
          [/\/\*/u, { token: "comment", next: "@blockComment" }],
          [/"(?:\\.|[^"\\])*"/u, "string"],
          [/'(?:\\.|[^'\\])*'/u, "string"],
          [/\b\d+(?:\.\d+)?\b/u, "number"],
          [/(class|extends)(\s+)([A-Za-z_А-Яа-яЁё][A-Za-z0-9_А-Яа-яЁё]*)/u, [
            "keyword.idyllium",
            "",
            "className.idyllium"
          ]],
          [/[A-ZА-ЯЁ][A-Za-z0-9_А-Яа-яЁё]*(?=\s+[A-Za-z_А-Яа-яЁё][A-Za-z0-9_А-Яа-яЁё]*\s*(?:[=;,)\[]|$))/u, "className.idyllium"],
          [/[A-Za-z_А-Яа-яЁё][A-Za-z0-9_А-Яа-яЁё]*(?=\s*\()/u, {
            cases: {
              "@keywords": "keyword.idyllium",
              "@builtinTypes": "typeName.idyllium",
              "@classNames": "className.idyllium",
              "@default": "function.idyllium"
            }
          }],
          [/[A-Za-z_А-Яа-яЁё][A-Za-z0-9_А-Яа-яЁё]*/u, {
            cases: {
              "@keywords": "keyword.idyllium",
              "@builtinTypes": "typeName.idyllium",
              "@classNames": "className.idyllium",
              "@default": "object.idyllium"
            }
          }],
          [/\./u, { token: "brackets.idyllium", next: "@afterDot" }],
          [/==|!=|<=|>=|\+=|-=|\*=|\/=/u, "brackets.idyllium"],
          [/[+\-*/<>=!{}()[\];,.:~]/u, "brackets.idyllium"]
        ],
        afterDot: [
          [/\s+/u, ""],
          [/[A-ZА-ЯЁ][A-Za-z0-9_А-Яа-яЁё]*(?=\s+[A-Za-z_А-Яа-яЁё][A-Za-z0-9_А-Яа-яЁё]*\s*(?:[=;,)\[]|$))/u, {
            token: "className.idyllium",
            next: "@pop"
          }],
          [/[A-Za-z_А-Яа-яЁё][A-Za-z0-9_А-Яа-яЁё]*(?=\s*\()/u, {
            cases: {
              "@qualifiedTypes": { token: "className.idyllium", next: "@pop" },
              "@classNames": { token: "className.idyllium", next: "@pop" },
              "@default": { token: "function.idyllium", next: "@pop" }
            }
          }],
          [/[A-Za-z_А-Яа-яЁё][A-Za-z0-9_А-Яа-яЁё]*/u, {
            cases: {
              "@qualifiedTypes": { token: "className.idyllium", next: "@pop" },
              "@classNames": { token: "className.idyllium", next: "@pop" },
              "@default": { token: "object.idyllium", next: "@pop" }
            }
          }],
          [/./u, { token: "brackets.idyllium", next: "@pop" }]
        ],
        blockComment: [
          [/[^*/]+/u, "comment"],
          [/\*\//u, { token: "comment", next: "@pop" }],
          [/./u, "comment"]
        ]
      }
    });
    monaco.languages.registerCompletionItemProvider(MONACO_LANGUAGE_ID, {
      triggerCharacters: [".", " ", "(", ","],
      provideCompletionItems(model, position, context) {
        const request = monacoCompletionRequest(model, position, context);
        if (!request) return { suggestions: [] };
        const items = projectCompletions(model.uri.path || viewerHost.currentFile(), model.getValue(), request.requestOffset).filter((item) => {
          if (request.kind === "use" && item.kind !== "module") return false;
          if (!request.prefix) return true;
          return item.name.toLowerCase().startsWith(request.prefix.toLowerCase());
        }).map((item) => ({
          label: item.name,
          kind: monacoCompletionKind(item.kind),
          detail: item.detail || item.kind,
          filterText: item.name,
          insertText: item.name,
          range: request.range
        }));
        return { suggestions: items };
      }
    });
    monaco.languages.registerDocumentSemanticTokensProvider(MONACO_LANGUAGE_ID, {
      getLegend() {
        return {
          tokenTypes: SEMANTIC_TOKEN_TYPES,
          tokenModifiers: SEMANTIC_TOKEN_MODIFIERS
        };
      },
      provideDocumentSemanticTokens(model) {
        return {
          data: encodeMonacoSemanticTokens(projectSemanticTokens(model.uri.path, model.getValue()))
        };
      },
      releaseDocumentSemanticTokens() {
      }
    });
    monaco.languages.registerSignatureHelpProvider(MONACO_LANGUAGE_ID, {
      signatureHelpTriggerCharacters: ["(", ",", "="],
      signatureHelpRetriggerCharacters: [",", "="],
      provideSignatureHelp(model, position) {
        const help = projectSignatureHelp(
          model.uri.path || viewerHost.currentFile(),
          model.getValue(),
          model.getOffsetAt(position)
        );
        if (!help) return null;
        return {
          value: {
            signatures: help.signatures.map((signature) => ({
              label: signature.label,
              documentation: signature.documentation,
              parameters: signature.parameters.map((parameter) => ({
                label: parameter.label,
                documentation: parameter.documentation
              }))
            })),
            activeSignature: help.activeSignature,
            activeParameter: help.activeParameter
          },
          dispose() {
          }
        };
      }
    });
    monaco.languages.registerDocumentFormattingEditProvider(MONACO_LANGUAGE_ID, {
      provideDocumentFormattingEdits(model) {
        return [{
          range: model.getFullModelRange(),
          text: window.Idyllium.formatIdyllium(model.getValue())
        }];
      }
    });
    monaco.editor.registerCommand("idyllium.copyDiagnostic", (_accessor, message) => {
      const text = String(message || "");
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(
          () => setStatus("Сообщение скопировано"),
          () => setStatus("Не удалось скопировать", true)
        );
      }
    });
    monaco.editor.registerCommand("idyllium.translateDiagnosticGoogle", (_accessor, message) => {
      window.open("https://translate.google.com/?sl=en&tl=ru&op=translate&text=" + encodeURIComponent(String(message || "")), "_blank", "noopener");
    });
    monaco.editor.registerCommand("idyllium.translateDiagnosticYandex", (_accessor, message) => {
      window.open("https://translate.yandex.ru/?source_lang=en&target_lang=ru&text=" + encodeURIComponent(String(message || "")), "_blank", "noopener");
    });
    monaco.languages.registerCodeActionProvider(MONACO_LANGUAGE_ID, {
      provideCodeActions(model, range, context) {
        const actions = [];
        for (const marker of context.markers || []) {
          if (typeof marker.message !== "string" || marker.message === "") continue;
          const label = marker.severity === monaco.MarkerSeverity.Warning ? "предупреждения" : "сообщения об ошибке";
          actions.push({
            title: "Скопировать текст " + label,
            kind: "quickfix",
            diagnostics: [marker],
            command: { id: "idyllium.copyDiagnostic", title: "copy", arguments: [marker.message] }
          });
          actions.push({
            title: "Перевести в Google Переводчике",
            kind: "quickfix",
            diagnostics: [marker],
            command: { id: "idyllium.translateDiagnosticGoogle", title: "translate", arguments: [marker.message] }
          });
          actions.push({
            title: "Перевести в Яндекс Переводчике",
            kind: "quickfix",
            diagnostics: [marker],
            command: { id: "idyllium.translateDiagnosticYandex", title: "translate", arguments: [marker.message] }
          });
        }
        return { actions, dispose() {
        } };
      }
    });
    defineMonacoThemes();
  }
  function defineMonacoThemes() {
    const monaco = window.monaco;
    monaco.editor.defineTheme("idyllium-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "keyword.idyllium", foreground: "b892ff" },
        { token: "typeName.idyllium", foreground: "63b3ff" },
        { token: "className.idyllium", foreground: "59d4b8" },
        { token: "function.idyllium", foreground: "e4d87e" },
        { token: "object.idyllium", foreground: "8bdfff" },
        { token: "namespace", foreground: "8bdfff" },
        { token: "class", foreground: "59d4b8" },
        { token: "function", foreground: "e4d87e" },
        { token: "method", foreground: "e4d87e" },
        { token: "property", foreground: "8bdfff" },
        { token: "variable", foreground: "f0ecf8" },
        { token: "parameter", foreground: "8bdfff" },
        { token: "variable.readonly", foreground: "8bdfff" },
        { token: "brackets.idyllium", foreground: "d0d6e6" },
        { token: "string.key.json", foreground: "8bdfff" },
        { token: "string.value.json", foreground: "d99a6c" },
        { token: "number.json", foreground: "c5d979" },
        { token: "keyword.json", foreground: "b892ff" },
        { token: "delimiter.bracket.json", foreground: "d0d6e6" },
        { token: "delimiter.array.json", foreground: "d0d6e6" },
        { token: "delimiter.colon.json", foreground: "d0d6e6" },
        { token: "delimiter.comma.json", foreground: "d0d6e6" },
        { token: "comment.line.json", foreground: "6ba36f", fontStyle: "italic" },
        { token: "comment.block.json", foreground: "6ba36f", fontStyle: "italic" },
        { token: "string", foreground: "d99a6c" },
        { token: "number", foreground: "c5d979" },
        { token: "comment", foreground: "6ba36f", fontStyle: "italic" }
      ],
      colors: {
        "focusBorder": "#00000000",
        "editor.background": "#120a1d",
        "editor.foreground": "#f0ecf8",
        "editorLineNumber.foreground": "#777088",
        "editorLineNumber.activeForeground": "#d0d6e6",
        "editorCursor.foreground": "#ffffff",
        "editor.selectionBackground": "#6aa4ff45",
        "editor.inactiveSelectionBackground": "#6aa4ff24",
        "editor.lineHighlightBackground": "#ffffff07",
        "editor.lineHighlightBorder": "#00000000",
        "editorBracketHighlight.foreground1": "#d0d6e6",
        "editorBracketHighlight.foreground2": "#d0d6e6",
        "editorBracketHighlight.foreground3": "#d0d6e6",
        "editorBracketHighlight.foreground4": "#d0d6e6",
        "editorBracketHighlight.foreground5": "#d0d6e6",
        "editorBracketHighlight.foreground6": "#d0d6e6",
        "editorBracketMatch.background": "#21182c",
        "editorBracketMatch.border": "#6aa4ff66",
        "editorIndentGuide.background1": "#2a2038",
        "editorIndentGuide.activeBackground1": "#4a405c",
        "editorGutter.background": "#120a1d",
        "editorSuggestWidget.background": "#1d1528",
        "editorSuggestWidget.border": "#342a43",
        "editorSuggestWidget.foreground": "#f0ecf8",
        "editorSuggestWidget.highlightForeground": "#8ec2ff",
        "editorSuggestWidget.selectedBackground": "#273956",
        "editorWidget.background": "#1d1528",
        "editorWidget.border": "#342a43"
      }
    });
    monaco.editor.defineTheme("idyllium-light", {
      base: "vs",
      inherit: true,
      rules: [
        { token: "keyword.idyllium", foreground: "8d3f75" },
        { token: "typeName.idyllium", foreground: "1d659a" },
        { token: "className.idyllium", foreground: "1b745c" },
        { token: "function.idyllium", foreground: "76620f" },
        { token: "object.idyllium", foreground: "0d667f" },
        { token: "namespace", foreground: "0d667f" },
        { token: "class", foreground: "1b745c" },
        { token: "function", foreground: "76620f" },
        { token: "method", foreground: "76620f" },
        { token: "property", foreground: "0d667f" },
        { token: "variable", foreground: "1d2230" },
        { token: "parameter", foreground: "0d667f" },
        { token: "variable.readonly", foreground: "0d667f" },
        { token: "brackets.idyllium", foreground: "445253" },
        { token: "string.key.json", foreground: "0d667f" },
        { token: "string.value.json", foreground: "87481f" },
        { token: "number.json", foreground: "5b7027" },
        { token: "keyword.json", foreground: "8d3f75" },
        { token: "delimiter.bracket.json", foreground: "445253" },
        { token: "delimiter.array.json", foreground: "445253" },
        { token: "delimiter.colon.json", foreground: "445253" },
        { token: "delimiter.comma.json", foreground: "445253" },
        { token: "comment.line.json", foreground: "477237", fontStyle: "italic" },
        { token: "comment.block.json", foreground: "477237", fontStyle: "italic" },
        { token: "string", foreground: "87481f" },
        { token: "number", foreground: "5b7027" },
        { token: "comment", foreground: "477237", fontStyle: "italic" }
      ],
      colors: {
        "focusBorder": "#00000000",
        "editor.background": "#d9d6df",
        "editor.foreground": "#252730",
        "editorLineNumber.foreground": "#77717f",
        "editorLineNumber.activeForeground": "#47424f",
        "editorCursor.foreground": "#23252c",
        "editor.selectionBackground": "#315f8c38",
        "editor.inactiveSelectionBackground": "#315f8c1c",
        "editor.lineHighlightBackground": "#275f9e0b",
        "editor.lineHighlightBorder": "#00000000",
        "editorBracketHighlight.foreground1": "#445253",
        "editorBracketHighlight.foreground2": "#445253",
        "editorBracketHighlight.foreground3": "#445253",
        "editorBracketHighlight.foreground4": "#445253",
        "editorBracketHighlight.foreground5": "#445253",
        "editorBracketHighlight.foreground6": "#445253",
        "editorBracketMatch.background": "#c6c2cd",
        "editorBracketMatch.border": "#827a8d",
        "editorIndentGuide.background1": "#c4c0ca",
        "editorIndentGuide.activeBackground1": "#9c95a4",
        "editorGutter.background": "#d9d6df",
        "editorSuggestWidget.background": "#e7e4ea",
        "editorSuggestWidget.border": "#aaa3b2",
        "editorSuggestWidget.foreground": "#252730",
        "editorSuggestWidget.highlightForeground": "#315f8c",
        "editorSuggestWidget.selectedBackground": "#c8d3df",
        "editorWidget.background": "#e7e4ea",
        "editorWidget.border": "#aaa3b2"
      }
    });
  }
  function completionRangeForMonaco(model, position) {
    const word = model.getWordUntilPosition(position);
    return new window.monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn);
  }
  function monacoCompletionRequest(model, position, context) {
    const monaco = window.monaco;
    const offset = model.getOffsetAt(position);
    const prefix = model.getValue().slice(0, offset);
    const manual = context && context.triggerKind === monaco.languages.CompletionTriggerKind.Invoke;
    const useMatch = /\buse\s+([A-Za-z_0-9]*)$/u.exec(prefix);
    if (useMatch) {
      return {
        kind: "use",
        prefix: useMatch[1] || "",
        requestOffset: offset,
        range: completionRangeForMonaco(model, position)
      };
    }
    const memberMatch = /[\p{L}\p{N}_\])"']\s*\.\s*([A-Za-z_А-Яа-яЁё][A-Za-z0-9_А-Яа-яЁё]*)?$/u.exec(prefix);
    if (memberMatch) {
      const memberPrefix = memberMatch[1] || "";
      return {
        kind: "member",
        prefix: memberPrefix,
        requestOffset: Math.max(0, offset - memberPrefix.length),
        range: new monaco.Range(
          position.lineNumber,
          Math.max(1, position.column - memberPrefix.length),
          position.lineNumber,
          position.column
        )
      };
    }
    const triggerCharacter = context && context.triggerCharacter;
    if ((triggerCharacter === "(" || triggerCharacter === "," || triggerCharacter === " ") && hasOpenCallableFrame(prefix)) {
      return {
        kind: "argument",
        prefix: "",
        requestOffset: offset,
        range: completionRangeForMonaco(model, position)
      };
    }
    if (!manual) return null;
    return {
      kind: "manual",
      prefix: "",
      requestOffset: offset,
      range: completionRangeForMonaco(model, position)
    };
  }
  function hasOpenCallableFrame(source) {
    const frames = [];
    let squareDepth = 0;
    for (let i = 0; i < source.length; i++) {
      const char = source[i];
      const next = source[i + 1];
      if (char === "/" && next === "/") {
        while (i < source.length && source[i] !== "\n") i++;
        continue;
      }
      if (char === "/" && next === "*") {
        i += 2;
        while (i + 1 < source.length && !(source[i] === "*" && source[i + 1] === "/")) i++;
        i++;
        continue;
      }
      if (char === '"' || char === "'") {
        const quote = char;
        i++;
        while (i < source.length) {
          if (source[i] === "\\") {
            i += 2;
            continue;
          }
          if (source[i] === quote) break;
          i++;
        }
        continue;
      }
      if (char === "[") squareDepth++;
      if (char === "]") squareDepth = Math.max(0, squareDepth - 1);
      if (char === "(") {
        frames.push(calleeTextBeforeOffset(source, i) !== null);
        continue;
      }
      if (char === ")") {
        frames.pop();
        continue;
      }
      if (char === "," && squareDepth === 0 && frames.length > 0) continue;
    }
    for (let i = frames.length - 1; i >= 0; i--) {
      if (frames[i]) return true;
    }
    return false;
  }
  function calleeTextBeforeOffset(source, openParenIndex) {
    const fragment = source.slice(Math.max(0, openParenIndex - 160), openParenIndex);
    const match = /((?:[\p{L}_][\p{L}\p{N}_]*\s*\.\s*)?[\p{L}_][\p{L}\p{N}_]*)\s*$/u.exec(fragment);
    if (!match) return null;
    const text = match[1].trim();
    return ["if", "while", "for", "function", "main", "constructor"].includes(text) ? null : text;
  }
  function projectCompletions(file, source, offset) {
    try {
      const normalized = normalizeWorkspacePath(file || viewerHost.currentFile());
      const projectFiles = textSourceMap();
      projectFiles.set(normalized, source);
      const project = new window.Idyllium.IdylliumProject({
        entryFile: MAIN_FILE,
        files: projectFiles
      });
      return deduplicateCompletions(project.completions({ file: normalized, offset })).slice(0, 80);
    } catch (_error) {
      return [];
    }
  }
  function projectSignatureHelp(file, source, offset) {
    try {
      const normalized = normalizeWorkspacePath(file || viewerHost.currentFile());
      const projectFiles = textSourceMap();
      projectFiles.set(normalized, source);
      const project = new window.Idyllium.IdylliumProject({
        entryFile: MAIN_FILE,
        files: projectFiles
      });
      return project.signatureHelp({ file: normalized, offset });
    } catch (_error) {
      return null;
    }
  }
  function projectSemanticTokens(file, source) {
    try {
      const normalized = normalizeWorkspacePath(file || viewerHost.currentFile());
      const projectFiles = textSourceMap();
      projectFiles.set(normalized, source);
      const project = new window.Idyllium.IdylliumProject({
        entryFile: MAIN_FILE,
        files: projectFiles
      });
      return project.semanticTokens(normalized);
    } catch (_error) {
      return [];
    }
  }
  function encodeMonacoSemanticTokens(tokens) {
    const sorted = [...tokens].filter((token) => token.range.start.line === token.range.end.line).sort((left, right) => left.range.start.line - right.range.start.line || left.range.start.column - right.range.start.column);
    const data = [];
    let previousLine = 0;
    let previousCharacter = 0;
    for (const token of sorted) {
      const line = Math.max(0, token.range.start.line - 1);
      const character = Math.max(0, token.range.start.column - 1);
      const length = Math.max(0, token.range.end.column - token.range.start.column);
      const tokenType = SEMANTIC_TOKEN_TYPES.indexOf(token.kind);
      if (length === 0 || tokenType < 0) continue;
      const deltaLine = line - previousLine;
      const deltaCharacter = deltaLine === 0 ? character - previousCharacter : character;
      let modifierMask = 0;
      for (const modifier of token.modifiers || []) {
        const index = SEMANTIC_TOKEN_MODIFIERS.indexOf(modifier);
        if (index >= 0) modifierMask |= 1 << index;
      }
      data.push(deltaLine, deltaCharacter, length, tokenType, modifierMask);
      previousLine = line;
      previousCharacter = character;
    }
    return new Uint32Array(data);
  }
  function monacoCompletionKind(kind) {
    const monaco = window.monaco;
    if (kind === "module") return monaco.languages.CompletionItemKind.Module;
    if (kind === "function") return monaco.languages.CompletionItemKind.Function;
    if (kind === "method") return monaco.languages.CompletionItemKind.Method;
    if (kind === "constant") return monaco.languages.CompletionItemKind.Constant;
    if (kind === "type") return monaco.languages.CompletionItemKind.Class;
    if (kind === "property") return monaco.languages.CompletionItemKind.Property;
    if (kind === "parameter") return monaco.languages.CompletionItemKind.Variable;
    if (kind === "variable") return monaco.languages.CompletionItemKind.Variable;
    return monaco.languages.CompletionItemKind.Text;
  }
  function deduplicateCompletions(items) {
    const byName = /* @__PURE__ */ new Map();
    for (const item of items) {
      if (!byName.has(item.name)) byName.set(item.name, item);
    }
    return [...byName.values()].sort((left, right) => left.name.localeCompare(right.name));
  }

  // packages/web-ide/src/main.js
  var DEFAULT_EDITOR_FONT_SIZE = 16;
  var DEFAULT_CONSOLE_FONT_SIZE = 13;
  var MIN_FONT_SIZE = 10;
  var MAX_FONT_SIZE = 32;
  var PROJECT_DB_NAME = "idyllium-web-ide";
  var PROJECT_DB_STORE = "project";
  var PROJECT_CATALOG_KEY = "project-catalog";
  var PROJECT_RECORD_PREFIX = "project:";
  var PROJECT_STATE_KEY = "autosave";
  var LAST_PROJECT_STORAGE_KEY = "idyllium-web-last-project";
  var DEFAULT_PROJECT_NAME = "Мой проект";
  var AUTOSAVE_DELAY_MS = 450;
  var LAYOUT_STORAGE_KEY = "idyllium-web-layout";
  var FONT_SIZE_STORAGE_KEY = "idyllium-web-editor-font-size";
  var CONSOLE_FONT_SIZE_STORAGE_KEY = "idyllium-web-console-font-size";
  var WEB_IDE_BASE_URL = detectWebIdeBaseUrl();
  var COLOR_PICKER_CHANNELS = ["red", "green", "blue", "alpha"];
  var folders = /* @__PURE__ */ new Set([WORKSPACE_ROOT]);
  var expandedFolders = /* @__PURE__ */ new Set([WORKSPACE_ROOT]);
  var currentFile = MAIN_FILE;
  var completionItems = [];
  var completionIndex = 0;
  var completionStart = 0;
  var editorReady = false;
  var saveTimer = null;
  var diagnosticsTimer = null;
  var monacoEditor = null;
  var monacoReady = false;
  var monacoModelSyncDepth = 0;
  var editorFontSize = readSavedEditorFontSize();
  var consoleFontSize = readSavedConsoleFontSize();
  var fileEditState = null;
  var internalDragPath = null;
  var internalDragType = "file";
  var colorPickerState = { red: 34, green: 145, blue: 188, alpha: 1 };
  var currentProjectId = "";
  var currentProjectName = DEFAULT_PROJECT_NAME;
  var projectCatalog = [];
  var projectWriteQueue = Promise.resolve();
  var pendingUploadConflictResolve = null;
  var colorCopyTimers = /* @__PURE__ */ new WeakMap();
  registerViewerHost({ openFile, currentFile: () => currentFile });
  registerRunHost({
    saveCurrentEditor,
    hideCompletions,
    getEditorValue,
    setEditorValue,
    isEditorReadOnly,
    updateEditorVisuals,
    editorReady: () => editorReady,
    scheduleAutosave,
    renderFiles,
    addProjectFolder,
    setProjectFile,
    removeProjectItem,
    fallbackFilePath,
    // Рантайм удалил текущий файл: перескочить на живой и сбросить редактор.
    resetToFallbackFile: () => {
      currentFile = fallbackFilePath();
      editorReady = false;
      openFile(currentFile);
    },
    applyPreviewTheme,
    folders
  });
  applySavedTheme();
  applyEditorFontSize(editorFontSize, false);
  applyConsoleFontSize(consoleFontSize, false);
  applySavedLayout();
  updateColorPickerUi();
  runButton.addEventListener("click", runProgram);
  stopButton.addEventListener("click", () => stopProgram(false));
  formatButton.addEventListener("click", formatCurrentFile);
  structuredTextViewButton.addEventListener("click", () => setStructuredViewMode("text"));
  structuredDataViewButton.addEventListener("click", () => setStructuredViewMode("structured"));
  newFileButton.addEventListener("click", () => startCreateItemInline("file", WORKSPACE_ROOT));
  newFolderButton.addEventListener("click", () => startCreateItemInline("folder", WORKSPACE_ROOT));
  document.getElementById("download-project-button").addEventListener("click", downloadProject);
  uploadButton.addEventListener("click", toggleUploadMenu);
  dropArea.addEventListener("click", () => uploadInput.click());
  uploadConflictSkip.addEventListener("click", () => resolveUploadConflict(false));
  uploadConflictReplace.addEventListener("click", () => resolveUploadConflict(true));
  fileList.addEventListener("contextmenu", (event) => {
    if (event.target instanceof Element && event.target.closest(".file-row")) return;
    event.preventDefault();
    openFileContextMenu({ type: "folder", name: "workspace", path: WORKSPACE_ROOT, children: [] }, event.clientX, event.clientY);
  });
  themeButton.addEventListener("click", toggleThemeMenu);
  fileAppMenuButton.addEventListener("click", toggleFileAppMenu);
  editAppMenuButton.addEventListener("click", toggleEditAppMenu);
  fileAppMenu.addEventListener("click", handleFileAppMenuClick);
  editAppMenu.addEventListener("click", handleEditAppMenuClick);
  colorPickerButton.addEventListener("click", toggleColorPickerMenu);
  themeDarkButton.addEventListener("click", () => {
    setTheme("dark");
    hideThemeMenu();
  });
  themeLightButton.addEventListener("click", () => {
    setTheme("light");
    hideThemeMenu();
  });
  fontSizeDecrease.addEventListener("click", () => applyEditorFontSize(editorFontSize - 1));
  fontSizeIncrease.addEventListener("click", () => applyEditorFontSize(editorFontSize + 1));
  fontSizeInput.addEventListener("change", () => applyEditorFontSize(Number(fontSizeInput.value)));
  fontSizeInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      applyEditorFontSize(Number(fontSizeInput.value));
      event.preventDefault();
    }
  });
  consoleFontSizeDecrease.addEventListener("click", () => applyConsoleFontSize(consoleFontSize - 1));
  consoleFontSizeIncrease.addEventListener("click", () => applyConsoleFontSize(consoleFontSize + 1));
  consoleFontSizeInput.addEventListener("change", () => applyConsoleFontSize(Number(consoleFontSizeInput.value)));
  consoleFontSizeInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      applyConsoleFontSize(Number(consoleFontSizeInput.value));
      event.preventDefault();
    }
  });
  installColorPicker();
  consoleInputSubmit.addEventListener("click", submitConsoleInput);
  consoleInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      submitConsoleInput();
      event.preventDefault();
    }
    if (event.key === "Escape") {
      stopProgram(false);
      event.preventDefault();
    }
  });
  uploadInput.addEventListener("change", () => {
    loadDroppedFiles(uploadInput.files);
    uploadInput.value = "";
  });
  installDropArea();
  document.addEventListener("click", (event) => {
    if (!uploadMenu.hidden && event.target instanceof Element && !event.target.closest(".upload-wrapper")) hideUploadMenu();
    if (!themeMenu.hidden && event.target instanceof Element && !event.target.closest(".theme-wrapper")) hideThemeMenu();
    if (!colorPickerMenu.hidden && event.target instanceof Element && !event.target.closest(".color-picker-wrapper")) hideColorPickerMenu();
    if (!fileAppMenu.hidden && event.target instanceof Element && !event.target.closest("#file-app-menu-wrapper")) hideFileAppMenu();
    if (!editAppMenu.hidden && event.target instanceof Element && !event.target.closest("#edit-app-menu-wrapper")) hideEditAppMenu();
    if (!fileContextMenu.hidden && event.target instanceof Element && !event.target.closest(".file-context-menu") && !event.target.closest(".file-menu-button")) hideFileContextMenu();
  });
  filePropsModal.addEventListener("click", (event) => {
    if (event.target === filePropsModal) hideFileProperties();
  });
  document.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      if (!runButton.disabled) runProgram();
      return;
    }
    if (event.key === "Escape") {
      hideFileProperties();
      hideFileContextMenu();
      hideThemeMenu();
      hideColorPickerMenu();
      hideFileAppMenu();
      hideEditAppMenu();
      hideUploadMenu();
    }
    if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === "s") {
      event.preventDefault();
      forceSaveCurrentProject();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === "n") {
      event.preventDefault();
      hideFileAppMenu();
      startCreateItemInline("file", WORKSPACE_ROOT);
      return;
    }
    if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === "o") {
      event.preventDefault();
      hideFileAppMenu();
      uploadInput.click();
    }
  });
  installColumnResizers();
  installRuntimeRowResizer();
  editor.addEventListener("input", handleEditorInput);
  editor.addEventListener("keydown", handleEditorKeydown);
  editor.addEventListener("click", () => {
    hideCompletions();
    updateEditorVisuals();
  });
  editor.addEventListener("scroll", syncEditorScroll);
  editor.addEventListener("blur", () => {
    window.setTimeout(hideCompletions, 120);
  });
  guiFrame.addEventListener("load", markGuiFrameReady);
  window.addEventListener("message", (event) => {
    if (previewTargetOrigin !== "*" && event.origin !== previewTargetOrigin) return;
    const data = event.data;
    if (!data || data.type !== "idylliumGuiEvent" || !data.message) return;
    if (data.message.type === "rendererReady") {
      markGuiFrameReady();
      return;
    }
    if (data.message.type === "closeApp") {
      stopProgram(false);
      return;
    }
    if (data.message.type !== "guiEvent") return;
    enqueueGuiEvent(data.message).catch(reportGuiEventFailure);
  });
  window.addEventListener("beforeunload", revokeAllBrowserAssetUrls);
  try {
    if (guiFrame.contentDocument?.readyState === "complete") markGuiFrameReady();
  } catch {
  }
  initializeMonaco().finally(initializeIde);
  async function initializeMonaco() {
    await prepareMonacoFont();
    return new Promise((resolve) => {
      if (!window.require || !monacoHost) {
        enableLegacyEditor();
        resolve(false);
        return;
      }
      window.require.config({ paths: { vs: monacoBasePath() } });
      window.require(["vs/editor/editor.main"], () => {
        registerMonacoIdyllium();
        monacoEditor = window.monaco.editor.create(monacoHost, {
          value: "",
          language: MONACO_LANGUAGE_ID,
          theme: currentMonacoTheme(),
          automaticLayout: true,
          autoClosingBrackets: "always",
          autoClosingQuotes: "always",
          autoIndent: "full",
          bracketPairColorization: { enabled: false },
          cursorBlinking: "smooth",
          detectIndentation: false,
          fontFamily: '"Source Code Pro", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
          fontSize: editorFontSize,
          fontLigatures: false,
          formatOnPaste: false,
          guides: {
            bracketPairs: false,
            bracketPairsHorizontal: false,
            highlightActiveIndentation: false,
            indentation: true
          },
          insertSpaces: true,
          lineHeight: editorLineHeight(editorFontSize),
          minimap: { enabled: false },
          padding: { top: 10, bottom: 8 },
          quickSuggestions: false,
          renderWhitespace: "selection",
          roundedSelection: false,
          scrollBeyondLastLine: false,
          "semanticHighlighting.enabled": true,
          smoothScrolling: true,
          suggestOnTriggerCharacters: true,
          suggest: { showWords: false },
          tabSize: 4,
          wordBasedSuggestions: "off"
        });
        monacoEditor.onDidChangeModelContent(() => {
          if (monacoModelSyncDepth === 0) saveCurrentEditor();
          scheduleMonacoDiagnostics();
        });
        monacoEditor.addCommand(window.monaco.KeyMod.CtrlCmd | window.monaco.KeyCode.Enter, runProgram);
        monacoEditor.addCommand(window.monaco.KeyMod.CtrlCmd | window.monaco.KeyCode.Space, () => {
          monacoEditor.trigger("keyboard", "editor.action.triggerSuggest", {});
        });
        legacyEditor.hidden = true;
        monacoReady = true;
        refreshMonacoFontMetrics();
        if (document.fonts?.ready) {
          document.fonts.ready.then(refreshMonacoFontMetrics).catch(() => {
          });
        }
        resolve(true);
      }, () => {
        enableLegacyEditor();
        resolve(false);
      });
    });
  }
  async function prepareMonacoFont() {
    if (!document.fonts || typeof document.fonts.load !== "function") return;
    try {
      await Promise.race([
        document.fonts.load(`400 ${editorFontSize}px "Source Code Pro"`),
        new Promise((resolve) => window.setTimeout(resolve, 2e3))
      ]);
    } catch {
    }
  }
  function monacoBasePath() {
    return new URL("monaco/vs", WEB_IDE_BASE_URL).toString().replace(/\/$/u, "");
  }
  function detectWebIdeBaseUrl() {
    const currentScript = document.currentScript;
    if (currentScript && typeof currentScript.src === "string" && currentScript.src) {
      return new URL(".", currentScript.src).toString();
    }
    const appScript = document.querySelector('script[src$="app.js"]');
    if (appScript && typeof appScript.src === "string" && appScript.src) {
      return new URL(".", appScript.src).toString();
    }
    const url = new URL(window.location.href);
    if (!url.pathname.endsWith("/")) {
      if (/\.[^/]+$/u.test(url.pathname)) {
        url.pathname = url.pathname.replace(/[^/]*$/u, "");
      } else {
        url.pathname += "/";
      }
    }
    return url.toString();
  }
  function enableLegacyEditor() {
    monacoReady = false;
    if (monacoHost) monacoHost.hidden = true;
    if (legacyEditor) legacyEditor.hidden = false;
  }
  function scheduleMonacoDiagnostics() {
    if (!monacoReady || !monacoEditor) return;
    if (diagnosticsTimer !== null) window.clearTimeout(diagnosticsTimer);
    diagnosticsTimer = window.setTimeout(() => {
      diagnosticsTimer = null;
      updateMonacoDiagnostics();
    }, 250);
  }
  function updateMonacoDiagnostics() {
    if (!monacoReady || !monacoEditor) return;
    const monaco = window.monaco;
    const model = monacoEditor.getModel();
    if (!model) return;
    if (!currentFile.endsWith(".idyl")) {
      monaco.editor.setModelMarkers(model, "idyllium", []);
      return;
    }
    try {
      saveCurrentEditor();
      const project = new window.Idyllium.IdylliumProject({
        entryFile: MAIN_FILE,
        files: textSourceMap()
      });
      const markers = project.diagnostics(currentFile).map((diagnostic) => diagnosticToMonacoMarker(diagnostic));
      monaco.editor.setModelMarkers(model, "idyllium", markers);
    } catch (_error) {
      monaco.editor.setModelMarkers(model, "idyllium", []);
    }
  }
  function diagnosticToMonacoMarker(diagnostic) {
    const monaco = window.monaco;
    const startLine = Math.max(1, diagnostic.range.start.line);
    const startColumn = Math.max(1, diagnostic.range.start.column);
    const endLine = Math.max(startLine, diagnostic.range.end.line);
    let endColumn = Math.max(1, diagnostic.range.end.column);
    if (endLine === startLine && endColumn <= startColumn) endColumn = startColumn + 1;
    return {
      severity: diagnosticSeverityToMonaco(diagnostic.severity),
      message: diagnostic.message,
      startLineNumber: startLine,
      startColumn,
      endLineNumber: endLine,
      endColumn
      // Машинный code и source в маркер НЕ кладём: Monaco приклеивает их к
      // тексту хинта одной строкой («…falseIdyllium(unused-variable)»), а
      // показ кодов людям ждёт отдельного вердикта владельца (2026-08-29).
      // Инструментам коды доступны через structured diagnostics компилятора.
    };
  }
  function diagnosticSeverityToMonaco(severity) {
    const MarkerSeverity = window.monaco.MarkerSeverity;
    if (severity === "warning") return MarkerSeverity.Warning;
    if (severity === "info") return MarkerSeverity.Info;
    return MarkerSeverity.Error;
  }
  function currentMonacoTheme() {
    return document.body.classList.contains("theme-light") ? "idyllium-light" : "idyllium-dark";
  }
  function readSavedEditorFontSize() {
    const raw = window.localStorage.getItem(FONT_SIZE_STORAGE_KEY);
    if (raw === null) return DEFAULT_EDITOR_FONT_SIZE;
    const saved = Number(raw);
    return normalizeEditorFontSize(Number.isFinite(saved) ? saved : DEFAULT_EDITOR_FONT_SIZE);
  }
  function readSavedConsoleFontSize() {
    const raw = window.localStorage.getItem(CONSOLE_FONT_SIZE_STORAGE_KEY);
    if (raw === null) return DEFAULT_CONSOLE_FONT_SIZE;
    const saved = Number(raw);
    return normalizeConsoleFontSize(Number.isFinite(saved) ? saved : DEFAULT_CONSOLE_FONT_SIZE);
  }
  function normalizeEditorFontSize(value) {
    return normalizeFontSize(value, DEFAULT_EDITOR_FONT_SIZE);
  }
  function normalizeConsoleFontSize(value) {
    return normalizeFontSize(value, DEFAULT_CONSOLE_FONT_SIZE);
  }
  function normalizeFontSize(value, fallback) {
    const rounded = Math.round(Number(value));
    if (!Number.isFinite(rounded)) return fallback;
    return clamp(rounded, MIN_FONT_SIZE, MAX_FONT_SIZE);
  }
  function editorLineHeight(fontSize) {
    return Math.max(18, Math.round(fontSize * 1.55));
  }
  function editorCharWidth(fontSize) {
    return fontSize * 0.61;
  }
  function consoleLineHeight(fontSize) {
    return Math.max(15, Math.round(fontSize * 1.45));
  }
  function applyEditorFontSize(value, persist = true) {
    editorFontSize = normalizeEditorFontSize(value);
    document.documentElement.style.setProperty("--editor-font-size", `${editorFontSize}px`);
    document.documentElement.style.setProperty("--editor-line-height", `${editorLineHeight(editorFontSize)}px`);
    fontSizeInput.value = String(editorFontSize);
    if (persist) window.localStorage.setItem(FONT_SIZE_STORAGE_KEY, String(editorFontSize));
    if (monacoReady && monacoEditor) {
      monacoEditor.updateOptions({
        fontSize: editorFontSize,
        lineHeight: editorLineHeight(editorFontSize)
      });
      refreshMonacoFontMetrics();
    }
    updateEditorVisuals();
  }
  function applyConsoleFontSize(value, persist = true) {
    consoleFontSize = normalizeConsoleFontSize(value);
    const lineHeight = consoleLineHeight(consoleFontSize);
    document.documentElement.style.setProperty("--console-font-size", `${consoleFontSize}px`);
    document.documentElement.style.setProperty("--console-line-height", `${lineHeight}px`);
    document.documentElement.style.setProperty("--console-control-height", `${Math.max(32, lineHeight + 13)}px`);
    consoleFontSizeInput.value = String(consoleFontSize);
    if (persist) window.localStorage.setItem(CONSOLE_FONT_SIZE_STORAGE_KEY, String(consoleFontSize));
  }
  function refreshMonacoFontMetrics() {
    if (!monacoReady || !monacoEditor || !window.monaco) return;
    window.monaco.editor.remeasureFonts?.();
    monacoEditor.layout();
    if (typeof monacoEditor.render === "function") monacoEditor.render(true);
  }
  async function initializeIde() {
    try {
      const saved = await initializeProjectStorage();
      if (saved && !isLegacyDefaultCanvasProject(saved)) {
        restoreProjectState(saved);
        setStatus("Проект восстановлен");
      }
    } catch (error) {
      setStatus("Не удалось восстановить проект", true);
      appendOutput(formatThrownError(error), "output-error");
    }
    renderFiles();
    if (!files.has(currentFile)) currentFile = fallbackFilePath();
    openFile(currentFile);
    updateCurrentProjectUi();
    postEmptySnapshot();
  }
  function renderFiles() {
    syncFoldersFromFiles();
    fileList.replaceChildren();
    for (const node of projectTree().children) renderTreeNode(node, 0);
  }
  function renderTreeNode(node, depth) {
    const editing = fileEditState && fileEditState.path === node.path;
    const row = document.createElement("div");
    row.className = "file-row file-row-" + node.type + (node.path === currentFile ? " active" : "");
    row.style.setProperty("--depth", String(depth));
    row.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      openFileContextMenu(node, event.clientX, event.clientY);
    });
    row.draggable = true;
    row.addEventListener("dragstart", (event) => {
      internalDragPath = node.path;
      internalDragType = node.type === "folder" ? "folder" : "file";
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", node.name);
      }
    });
    row.addEventListener("dragend", () => {
      internalDragPath = null;
      clearMoveTargetHighlight();
    });
    if (node.type === "folder") {
      row.addEventListener("dragover", (event) => {
        if (!internalDragPath || internalDragPath === node.path) return;
        event.preventDefault();
        event.stopPropagation();
        if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
        row.classList.add("drag-target");
      });
      row.addEventListener("dragleave", () => {
        row.classList.remove("drag-target");
      });
      row.addEventListener("drop", (event) => {
        if (!internalDragPath) return;
        event.preventDefault();
        event.stopPropagation();
        const dragged = internalDragPath;
        const draggedType = internalDragType;
        internalDragPath = null;
        clearMoveTargetHighlight();
        moveProjectItemTo(dragged, draggedType, node.path);
      });
    }
    if (editing) {
      row.appendChild(createInlineFileEditor(node));
      fileList.appendChild(row);
      window.setTimeout(() => focusInlineFileEditor(node.path), 0);
      if (node.type !== "folder" || !expandedFolders.has(node.path)) return;
      for (const child of node.children) renderTreeNode(child, depth + 1);
      return;
    }
    const main = document.createElement("button");
    main.type = "button";
    main.className = "file-main-button";
    main.appendChild(createIcon(nodeIconName(node)));
    const name = document.createElement("span");
    name.className = "file-name";
    name.textContent = node.name;
    main.appendChild(name);
    main.addEventListener("click", () => {
      if (node.type === "folder") {
        toggleFolder(node.path);
        return;
      }
      openFile(node.path);
    });
    row.appendChild(main);
    const menu = document.createElement("button");
    menu.type = "button";
    menu.className = "file-menu-button";
    menu.title = "действия";
    menu.setAttribute("aria-label", `действия: ${node.name}`);
    menu.appendChild(createIcon("menu"));
    menu.addEventListener("click", (event) => {
      event.stopPropagation();
      const rect = menu.getBoundingClientRect();
      openFileContextMenu(node, rect.right + 4, rect.top);
    });
    row.appendChild(menu);
    fileList.appendChild(row);
    if (node.type !== "folder" || !expandedFolders.has(node.path)) return;
    for (const child of node.children) renderTreeNode(child, depth + 1);
  }
  function openFile(file) {
    saveCurrentEditor();
    currentFile = file;
    const item = files.get(file);
    editorTitle.textContent = shortFileName(file);
    editorReady = true;
    hideCompletions();
    if (item && item.kind === "text") {
      showTextEditor();
      setEditorValue(item.content || "", file);
      setEditorReadOnly(false);
      updateEditorVisuals();
      if (isCsvFile(file) && structuredViewModes.get(file) === "table") {
        showCsvTable(file, item.content || "");
      } else if (isJsonFile(file) && structuredViewModes.get(file) === "tree") {
        showJsonTree(file, item.content || "");
      } else if (isMarkdownFile(file) && structuredViewModes.get(file) === "preview") {
        showMarkdownPreview(file, item.content || "");
      } else if (isSvgFile(file) && (structuredViewModes.get(file) || "image") === "image") {
        showSvgImagePreview(file, item.content || "");
      }
    } else if (item && item.kind === "asset") {
      showAssetViewer(file, item);
      setEditorReadOnly(true);
      setStatus("Открыт ассет");
    } else {
      showTextEditor();
      setEditorValue("", file);
      setEditorReadOnly(true);
      updateEditorVisuals();
    }
    updateFormatButton();
    updateRunButton();
    updateStructuredViewToggle();
    renderFiles();
    scheduleAutosave();
  }
  function showTextEditor() {
    invalidateAssetPreview();
    releaseAssetViewerResources();
    if (assetViewer) {
      assetViewer.hidden = true;
      assetViewer.replaceChildren();
    }
    if (csvViewer) {
      csvViewer.hidden = true;
      csvViewer.replaceChildren();
    }
    if (jsonViewer) {
      jsonViewer.hidden = true;
      jsonViewer.replaceChildren();
    }
    if (markdownViewer) {
      markdownViewer.hidden = true;
      markdownViewer.replaceChildren();
    }
    if (monacoReady && monacoHost) {
      monacoHost.hidden = false;
      if (legacyEditor) legacyEditor.hidden = true;
      window.setTimeout(() => monacoEditor?.layout(), 0);
      return;
    }
    if (monacoHost) monacoHost.hidden = true;
    if (legacyEditor) legacyEditor.hidden = false;
  }
  function showSvgImagePreview(file, source) {
    const bytes = new TextEncoder().encode(source);
    showAssetViewer(file, { kind: "asset", content: "", bytes });
  }
  function setStructuredViewMode(mode) {
    const item = files.get(currentFile);
    const structuredMode = structuredViewMode(currentFile);
    if (!item || item.kind !== "text" || !structuredMode) return;
    if (mode === "structured") {
      saveCurrentEditor();
      structuredViewModes.set(currentFile, structuredMode);
      if (structuredMode === "table") showCsvTable(currentFile, item.content || "");
      else if (structuredMode === "tree") showJsonTree(currentFile, item.content || "");
      else if (structuredMode === "image") showSvgImagePreview(currentFile, item.content || "");
      else showMarkdownPreview(currentFile, item.content || "");
    } else {
      structuredViewModes.set(currentFile, "text");
      showTextEditor();
      setEditorReadOnly(false);
      window.setTimeout(() => monacoEditor?.focus(), 0);
    }
    updateStructuredViewToggle();
  }
  function updateStructuredViewToggle() {
    if (!structuredViewToggle || !structuredTextViewButton || !structuredDataViewButton) return;
    const item = files.get(currentFile);
    const structuredMode = structuredViewMode(currentFile);
    const available = Boolean(item && item.kind === "text" && structuredMode);
    const defaultMode = structuredMode === "image" ? "image" : "text";
    const mode = available ? structuredViewModes.get(currentFile) || defaultMode : "text";
    const formatName = isCsvFile(currentFile) ? "CSV" : isJsonFile(currentFile) ? "JSON" : isSvgFile(currentFile) ? "SVG" : "Markdown";
    structuredViewToggle.hidden = !available;
    structuredViewToggle.setAttribute("aria-label", `Режим просмотра ${formatName}`);
    structuredDataViewButton.textContent = structuredMode === "table" ? "Таблица" : structuredMode === "tree" ? "Дерево" : structuredMode === "image" ? "Картинка" : "Просмотр";
    structuredTextViewButton.classList.toggle("active", mode === "text");
    structuredDataViewButton.classList.toggle("active", mode === structuredMode);
    structuredTextViewButton.setAttribute("aria-pressed", String(mode === "text"));
    structuredDataViewButton.setAttribute("aria-pressed", String(mode === structuredMode));
  }
  function showCsvTable(file, source) {
    invalidateAssetPreview();
    releaseAssetViewerResources();
    if (monacoHost) monacoHost.hidden = true;
    if (legacyEditor) legacyEditor.hidden = true;
    if (assetViewer) {
      assetViewer.hidden = true;
      assetViewer.replaceChildren();
    }
    if (jsonViewer) {
      jsonViewer.hidden = true;
      jsonViewer.replaceChildren();
    }
    if (markdownViewer) {
      markdownViewer.hidden = true;
      markdownViewer.replaceChildren();
    }
    if (!csvViewer) return;
    csvViewer.hidden = false;
    csvViewer.replaceChildren();
    renderCsvTable(file, source);
  }
  function showJsonTree(file, source) {
    invalidateAssetPreview();
    releaseAssetViewerResources();
    if (monacoHost) monacoHost.hidden = true;
    if (legacyEditor) legacyEditor.hidden = true;
    if (assetViewer) {
      assetViewer.hidden = true;
      assetViewer.replaceChildren();
    }
    if (csvViewer) {
      csvViewer.hidden = true;
      csvViewer.replaceChildren();
    }
    if (markdownViewer) {
      markdownViewer.hidden = true;
      markdownViewer.replaceChildren();
    }
    if (!jsonViewer) return;
    jsonViewer.hidden = false;
    jsonViewer.replaceChildren();
    renderJsonTree(file, source);
  }
  function showMarkdownPreview(file, source) {
    invalidateAssetPreview();
    releaseAssetViewerResources();
    if (monacoHost) monacoHost.hidden = true;
    if (legacyEditor) legacyEditor.hidden = true;
    if (assetViewer) {
      assetViewer.hidden = true;
      assetViewer.replaceChildren();
    }
    if (csvViewer) {
      csvViewer.hidden = true;
      csvViewer.replaceChildren();
    }
    if (jsonViewer) {
      jsonViewer.hidden = true;
      jsonViewer.replaceChildren();
    }
    if (!markdownViewer) return;
    markdownViewer.hidden = false;
    markdownViewer.replaceChildren();
    renderMarkdownPreview(file, source);
  }
  function updateFormatButton() {
    if (!formatButton) return;
    const item = files.get(currentFile);
    const available = Boolean(item && item.kind === "text" && currentFile.endsWith(".idyl"));
    formatButton.hidden = !available;
    formatButton.disabled = !available;
  }
  function saveCurrentEditor() {
    if (!editorReady) return;
    const item = files.get(currentFile);
    if (!item || item.kind !== "text" || isEditorReadOnly()) return;
    if (monacoReady && monacoEditor) {
      const model = monacoEditor.getModel();
      if (!model || normalizeWorkspacePath(model.uri.path) !== currentFile) return;
    }
    const value = getEditorValue();
    if (item.content === value) return;
    item.content = value;
    scheduleAutosave();
  }
  function handleEditorInput() {
    saveCurrentEditor();
    updateEditorVisuals();
    if (!monacoReady) refreshCompletions(false);
  }
  function updateEditorVisuals() {
    if (monacoReady) {
      scheduleMonacoDiagnostics();
      return;
    }
    const source = editor.value;
    highlight.innerHTML = currentFile.endsWith(".idyl") ? highlightIdyllium(source) : escapeHtml(source);
    const lines = Math.max(1, source.split("\n").length);
    lineNumbers.textContent = Array.from({ length: lines }, (_item, index) => String(index + 1)).join("\n");
    syncEditorScroll();
  }
  function syncEditorScroll() {
    if (monacoReady) return;
    const pre = document.getElementById("highlight");
    pre.scrollTop = editor.scrollTop;
    pre.scrollLeft = editor.scrollLeft;
    lineNumbers.scrollTop = editor.scrollTop;
  }
  function getEditorValue() {
    return monacoReady && monacoEditor ? monacoEditor.getValue() : editor.value;
  }
  function setEditorValue(value, file) {
    if (monacoReady && monacoEditor) {
      const monaco = window.monaco;
      const uri = monaco.Uri.parse("file://" + normalizeWorkspacePath(file || currentFile));
      const language = monacoLanguageForFile(file || currentFile);
      monacoModelSyncDepth++;
      try {
        let model = monaco.editor.getModel(uri);
        if (!model) {
          model = monaco.editor.createModel(value, language, uri);
        } else {
          if (model.getLanguageId() !== language) monaco.editor.setModelLanguage(model, language);
          if (model.getValue() !== value) model.setValue(value);
        }
        monacoEditor.setModel(model);
      } finally {
        monacoModelSyncDepth--;
      }
      window.setTimeout(() => {
        monacoEditor.layout();
        scheduleMonacoDiagnostics();
      }, 0);
      return;
    }
    editor.value = value;
  }
  function monacoLanguageForFile(file) {
    const name = String(file || "").toLowerCase();
    if (name.endsWith(".idyl")) return MONACO_LANGUAGE_ID;
    if (name.endsWith(".json")) return "json";
    if (name.endsWith(".xml")) return "xml";
    if (name.endsWith(".html") || name.endsWith(".htm")) return "html";
    if (name.endsWith(".css")) return "css";
    if (name.endsWith(".md") || name.endsWith(".markdown")) return "markdown";
    return "plaintext";
  }
  function setEditorReadOnly(readOnly) {
    if (monacoReady && monacoEditor) {
      monacoEditor.updateOptions({ readOnly });
    }
    editor.disabled = readOnly;
  }
  function isEditorReadOnly() {
    return monacoReady && monacoEditor ? Boolean(monacoEditor.getOption(window.monaco.editor.EditorOption.readOnly)) : editor.disabled;
  }
  function createInlineFileEditor(node) {
    const wrapper = document.createElement("div");
    wrapper.className = "file-main-button file-inline-editor";
    wrapper.appendChild(createIcon(nodeIconName(node)));
    const input = document.createElement("input");
    input.className = "file-name-input";
    input.type = "text";
    input.value = fileEditState.value || node.name;
    input.dataset.editPath = node.path;
    input.setAttribute("aria-label", "имя файла или папки");
    input.addEventListener("input", () => {
      fileEditState.value = input.value;
      updateInlineFileEditorValidity(input);
    });
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        commitInlineFileEdit(input);
        event.preventDefault();
      }
      if (event.key === "Escape") {
        cancelInlineFileEdit();
        event.preventDefault();
      }
    });
    input.addEventListener("blur", () => commitInlineFileEdit(input));
    wrapper.appendChild(input);
    updateInlineFileEditorValidity(input);
    return wrapper;
  }
  function focusInlineFileEditor(path) {
    const input = [...fileList.querySelectorAll(".file-name-input")].find((item) => item.dataset.editPath === path);
    if (!input) return;
    input.focus();
    input.select();
  }
  function startCreateItemInline(type, parent) {
    cancelInlineFileEdit();
    parent = normalizeWorkspacePath(parent || WORKSPACE_ROOT);
    const baseName = type === "folder" ? "new_folder" : "new_file.idyl";
    const path = uniqueChildPath(parent, baseName);
    if (type === "folder") addProjectFolder(path);
    else setProjectFile(path, { kind: "text", content: "" });
    expandedFolders.add(parent);
    fileEditState = { mode: "create", type, path, value: basename(path), temporary: true };
    renderFiles();
  }
  function startRenameItemInline(path, type) {
    cancelInlineFileEdit();
    path = normalizeWorkspacePath(path);
    fileEditState = { mode: "rename", type, path, value: basename(path), temporary: false };
    renderFiles();
  }
  function startDuplicateItemInline(path, type) {
    cancelInlineFileEdit();
    path = normalizeWorkspacePath(path);
    const newPath = uniqueCopyPath(path);
    if (!copyProjectItem(path, type, newPath)) return;
    expandedFolders.add(parentPath(newPath));
    fileEditState = { mode: "duplicate", type, path: newPath, value: basename(newPath), temporary: true };
    renderFiles();
  }
  function commitInlineFileEdit(input) {
    if (!fileEditState) return;
    const name = input.value.trim();
    if (!name) {
      if (fileEditState.temporary) cancelInlineFileEdit();
      else {
        input.classList.add("invalid");
        window.setTimeout(() => input.focus(), 0);
      }
      return;
    }
    if (inlineFileNameError(name, fileEditState)) {
      input.classList.add("invalid");
      window.setTimeout(() => input.focus(), 0);
      return;
    }
    const state = fileEditState;
    const newPath = normalizeWorkspacePath(shortFileName(parentPath(state.path)) + "/" + name);
    fileEditState = null;
    if (newPath === state.path) {
      if (state.temporary) {
        if (state.type === "file") openFile(state.path);
        else renderFiles();
        setStatus(state.mode === "duplicate" ? state.type === "folder" ? "Папка дублирована" : "Файл дублирован" : state.type === "folder" ? "Папка создана" : "Файл создан");
        scheduleAutosave();
        return;
      }
      renderFiles();
      return;
    }
    renameProjectItem(state.path, state.type, newPath);
    if (state.type === "file") openFile(newPath);
  }
  function cancelInlineFileEdit() {
    if (!fileEditState) return;
    const state = fileEditState;
    fileEditState = null;
    if (state.temporary) removeProjectItem(state.path, state.type);
    renderFiles();
  }
  function updateInlineFileEditorValidity(input) {
    if (!fileEditState) return;
    input.classList.toggle("invalid", Boolean(inlineFileNameError(input.value.trim(), fileEditState)));
  }
  function inlineFileNameError(name, state) {
    if (!name || name === "." || name === "..") return "empty";
    if (/[\\/]/u.test(name) || /[\u0000-\u001f]/u.test(name)) return "invalid";
    const path = normalizeWorkspacePath(shortFileName(parentPath(state.path)) + "/" + name);
    if (path !== state.path && (files.has(path) || folders.has(path))) return "conflict";
    if (hasFileAncestor(path)) return "invalid";
    return "";
  }
  function uniqueChildPath(parent, baseName) {
    parent = normalizeWorkspacePath(parent || WORKSPACE_ROOT);
    const dot = baseName.lastIndexOf(".");
    const stem = dot > 0 ? baseName.slice(0, dot) : baseName;
    const ext = dot > 0 ? baseName.slice(dot) : "";
    let index = 0;
    while (true) {
      const suffix = index === 0 ? "" : String(index + 1);
      const candidate = normalizeWorkspacePath(shortFileName(parent) + "/" + stem + suffix + ext);
      if (!files.has(candidate) && !folders.has(candidate)) return candidate;
      index++;
    }
  }
  function copyProjectItem(path, type, newPath) {
    path = normalizeWorkspacePath(path);
    newPath = normalizeWorkspacePath(newPath);
    if (!validateAvailableItemPath(newPath)) return false;
    saveCurrentEditor();
    if (type === "file") {
      const item = files.get(path);
      if (!item) {
        setStatus("Файл не найден", true);
        return false;
      }
      setProjectFile(newPath, cloneFileItem(item));
      return true;
    }
    if (!folders.has(path)) {
      setStatus("Папка не найдена", true);
      return false;
    }
    if (newPath.startsWith(path + "/")) {
      setStatus("Нельзя дублировать папку внутрь самой себя", true);
      return false;
    }
    const prefix = path + "/";
    addProjectFolder(newPath);
    for (const folder of [...folders].filter((folder2) => folder2.startsWith(prefix))) {
      addProjectFolder(newPath + folder.slice(path.length));
    }
    for (const [file, item] of [...files.entries()].filter(([file2]) => file2.startsWith(prefix))) {
      setProjectFile(newPath + file.slice(path.length), cloneFileItem(item));
    }
    return true;
  }
  function renameProjectItem(path, type, newPath, doneMessage) {
    path = normalizeWorkspacePath(path);
    newPath = normalizeWorkspacePath(newPath);
    if (path === newPath) {
      return;
    }
    if (!validateAvailableItemPath(newPath)) return;
    saveCurrentEditor();
    if (type === "file") {
      const item = files.get(path);
      if (!item) {
        setStatus("Файл не найден", true);
        return;
      }
      files.delete(path);
      setProjectFile(newPath, cloneFileItem(item));
      if (currentFile === path) currentFile = newPath;
      expandedFolders.add(parentPath(newPath));
      openFile(currentFile);
      setStatus(doneMessage || "Файл переименован");
      scheduleAutosave();
      return;
    }
    if (!folders.has(path)) {
      setStatus("Папка не найдена", true);
      return;
    }
    if (newPath.startsWith(path + "/")) {
      setStatus("Нельзя переместить папку внутрь самой себя", true);
      return;
    }
    const prefix = path + "/";
    const movedFolders = [...folders].filter((folder) => folder === path || folder.startsWith(prefix)).map((folder) => newPath + folder.slice(path.length));
    const movedFiles = [...files.entries()].filter(([file]) => file.startsWith(prefix)).map(([file, item]) => [newPath + file.slice(path.length), cloneFileItem(item)]);
    for (const folder of [...folders]) {
      if (folder === path || folder.startsWith(prefix)) folders.delete(folder);
    }
    for (const file of [...files.keys()]) {
      if (file.startsWith(prefix)) files.delete(file);
    }
    for (const folder of movedFolders) addProjectFolder(folder);
    for (const [file, item] of movedFiles) setProjectFile(file, item);
    for (const folder of [...expandedFolders]) {
      if (folder === path || folder.startsWith(prefix)) {
        expandedFolders.delete(folder);
        expandedFolders.add(newPath + folder.slice(path.length));
      }
    }
    expandedFolders.add(parentPath(newPath));
    if (currentFile.startsWith(prefix)) currentFile = newPath + currentFile.slice(path.length);
    openFile(currentFile);
    setStatus(doneMessage || "Папка переименована");
    scheduleAutosave();
  }
  function moveProjectItemTo(sourcePath, type, targetFolder) {
    sourcePath = normalizeWorkspacePath(sourcePath);
    targetFolder = normalizeWorkspacePath(targetFolder);
    if (targetFolder !== WORKSPACE_ROOT && !folders.has(targetFolder)) {
      setStatus("Папка не найдена", true);
      return;
    }
    if (parentPath(sourcePath) === targetFolder) return;
    if (type === "folder" && (targetFolder === sourcePath || targetFolder.startsWith(sourcePath + "/"))) {
      setStatus("Нельзя переместить папку внутрь самой себя", true);
      return;
    }
    expandedFolders.add(targetFolder);
    renameProjectItem(
      sourcePath,
      type,
      targetFolder + "/" + itemName(sourcePath),
      type === "folder" ? "Папка перемещена" : "Файл перемещён"
    );
  }
  function clearMoveTargetHighlight() {
    for (const element of fileList.querySelectorAll(".drag-target")) {
      element.classList.remove("drag-target");
    }
  }
  function openDeleteConfirm(path, type, left, top) {
    fileContextMenu.replaceChildren();
    const label = document.createElement("div");
    label.className = "file-delete-prompt";
    label.textContent = "Удалить?";
    fileContextMenu.appendChild(label);
    const actions = document.createElement("div");
    actions.className = "file-delete-actions";
    const yes = document.createElement("button");
    yes.type = "button";
    yes.textContent = "Да";
    yes.addEventListener("click", () => {
      hideFileContextMenu();
      deleteProjectItem(path, type);
    });
    const no = document.createElement("button");
    no.type = "button";
    no.textContent = "Нет";
    no.addEventListener("click", hideFileContextMenu);
    actions.append(yes, no);
    fileContextMenu.appendChild(actions);
    positionFileContextMenu(left, top);
  }
  function deleteProjectItem(path, type) {
    path = normalizeWorkspacePath(path);
    saveCurrentEditor();
    removeProjectItem(path, type);
    if (files.size === 0) setProjectFile(MAIN_FILE, { kind: "text", content: "" });
    if (!files.has(currentFile)) currentFile = fallbackFilePath();
    editorReady = false;
    openFile(currentFile);
    setStatus(type === "folder" ? "Папка удалена" : "Файл удалён");
    scheduleAutosave();
  }
  function removeProjectItem(path, type) {
    path = normalizeWorkspacePath(path);
    if (type === "folder") {
      const prefix = path + "/";
      for (const file of [...files.keys()]) {
        if (file.startsWith(prefix)) files.delete(file);
      }
      for (const folder of [...folders]) {
        if (folder === path || folder.startsWith(prefix)) folders.delete(folder);
      }
      for (const folder of [...expandedFolders]) {
        if (folder === path || folder.startsWith(prefix)) expandedFolders.delete(folder);
      }
      return;
    }
    files.delete(path);
  }
  function openFileContextMenu(node, left, top) {
    fileContextMenu.replaceChildren();
    const actions = node.path === WORKSPACE_ROOT ? [
      ["Новый файл", () => startCreateItemInline("file", WORKSPACE_ROOT)],
      ["Новая папка", () => startCreateItemInline("folder", WORKSPACE_ROOT)],
      ["Свойства", () => showFileProperties(WORKSPACE_ROOT, "folder")]
    ] : node.type === "folder" ? [
      ["Новый файл", () => startCreateItemInline("file", node.path)],
      ["Новая папка", () => startCreateItemInline("folder", node.path)],
      ["Переименовать", () => startRenameItemInline(node.path, "folder")],
      ["Дублировать", () => startDuplicateItemInline(node.path, "folder")],
      ["Копировать имя", () => copyProjectItemText(itemName(node.path), "Имя скопировано")],
      ["Копировать путь", () => copyProjectItemText(studentPath(node.path), "Путь скопирован")],
      ["Свойства", () => showFileProperties(node.path, "folder")],
      ["Удалить", () => openDeleteConfirm(node.path, "folder", left, top)]
    ] : [
      ["Переименовать", () => startRenameItemInline(node.path, "file")],
      ["Дублировать", () => startDuplicateItemInline(node.path, "file")],
      ["Скачать", () => downloadProjectFile(node.path)],
      ["Копировать имя", () => copyProjectItemText(itemName(node.path), "Имя скопировано")],
      ["Копировать путь", () => copyProjectItemText(studentPath(node.path), "Путь скопирован")],
      ["Свойства", () => showFileProperties(node.path, "file")],
      ["Удалить", () => openDeleteConfirm(node.path, "file", left, top)]
    ];
    for (const [label, action] of actions) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        hideFileContextMenu();
        action();
      });
      fileContextMenu.appendChild(button);
    }
    positionFileContextMenu(left, top);
  }
  function copyProjectItemText(text, doneMessage) {
    const fallbackCopy = () => {
      const scratch = document.createElement("textarea");
      scratch.value = text;
      scratch.style.position = "fixed";
      scratch.style.opacity = "0";
      document.body.appendChild(scratch);
      scratch.select();
      let copied = false;
      try {
        copied = document.execCommand("copy");
      } catch (error) {
        copied = false;
      }
      scratch.remove();
      setStatus(copied ? doneMessage : "Не удалось скопировать", !copied);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => setStatus(doneMessage), fallbackCopy);
    } else {
      fallbackCopy();
    }
  }
  function fileItemByteSize(item) {
    if (!item) return null;
    if (item.bytes instanceof Uint8Array) return item.bytes.length;
    if (typeof item.content === "string") return new TextEncoder().encode(item.content).length;
    return null;
  }
  function formatByteSize(size) {
    if (size === null) return "неизвестно";
    if (size < 1024) return `${size} Б`;
    const units = [["КБ", 1024], ["МБ", 1024 * 1024], ["ГБ", 1024 * 1024 * 1024]];
    for (let i = units.length - 1; i >= 0; i -= 1) {
      if (size >= units[i][1]) {
        const value = size / units[i][1];
        return `${value >= 100 ? Math.round(value) : value.toFixed(1).replace(".", ",")} ${units[i][0]} (${size.toLocaleString("ru-RU")} Б)`;
      }
    }
    return `${size} Б`;
  }
  var FILE_EXTENSION_TYPES = {
    idyl: "программа Idyllium",
    txt: "текстовый файл",
    md: "текст с разметкой (Markdown)",
    html: "веб-страница (HTML)",
    css: "таблица стилей (CSS)",
    js: "скрипт JavaScript",
    json: "данные JSON",
    csv: "таблица (CSV)",
    svg: "векторная картинка (SVG)",
    png: "картинка (PNG)",
    jpg: "картинка (JPEG)",
    jpeg: "картинка (JPEG)",
    gif: "картинка (GIF)",
    webp: "картинка (WebP)",
    bmp: "картинка (BMP)",
    ico: "значок (ICO)",
    wav: "звук (WAV)",
    mp3: "звук (MP3)",
    ogg: "звук (OGG)",
    ttf: "шрифт (TTF)",
    otf: "шрифт (OTF)",
    woff: "шрифт (WOFF)",
    woff2: "шрифт (WOFF2)",
    db: "база данных SQLite",
    sqlite: "база данных SQLite",
    zip: "архив ZIP",
    pdf: "документ PDF"
  };
  function extensionTypeLabel(name) {
    const dot = name.lastIndexOf(".");
    if (dot <= 0) return "без расширения";
    const extension = name.slice(dot + 1).toLowerCase();
    return FILE_EXTENSION_TYPES[extension] || `неизвестное расширение «.${extension}»`;
  }
  function isBinaryFileItem(item) {
    return Boolean(item) && item.bytes instanceof Uint8Array;
  }
  function sniffContentType(item) {
    if (!item) return "неизвестно";
    if (!isBinaryFileItem(item)) {
      const content = item.content || "";
      if (/^\s*<svg[\s>]/iu.test(content)) return "векторная картинка (SVG)";
      return "текст (UTF-8)";
    }
    const bytes = item.bytes;
    if (bytes.length === 0) return "двоичные данные";
    const ascii = (start, text) => {
      for (let i = 0; i < text.length; i += 1) {
        if (bytes[start + i] !== text.charCodeAt(i)) return false;
      }
      return true;
    };
    if (bytes[0] === 137 && ascii(1, "PNG")) return "картинка (PNG)";
    if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return "картинка (JPEG)";
    if (ascii(0, "GIF87a") || ascii(0, "GIF89a")) return "картинка (GIF)";
    if (ascii(0, "RIFF") && ascii(8, "WEBP")) return "картинка (WebP)";
    if (ascii(0, "RIFF") && ascii(8, "WAVE")) return "звук (WAV)";
    if (ascii(0, "BM")) return "картинка (BMP)";
    if (ascii(0, "OggS")) return "звук (OGG)";
    if (ascii(0, "ID3") || bytes[0] === 255 && (bytes[1] & 224) === 224) return "звук (MP3)";
    if (ascii(0, "SQLite format 3")) return "база данных SQLite";
    if (ascii(0, "PK") && bytes[2] === 3 && bytes[3] === 4) return "архив ZIP";
    if (ascii(0, "%PDF")) return "документ PDF";
    if (ascii(0, "OTTO")) return "шрифт (OTF)";
    if (bytes[0] === 0 && bytes[1] === 1 && bytes[2] === 0 && bytes[3] === 0) return "шрифт (TTF)";
    if (ascii(0, "wOFF")) return "шрифт (WOFF)";
    if (ascii(0, "wOF2")) return "шрифт (WOFF2)";
    if (bytes[0] === 0 && bytes[1] === 0 && bytes[2] === 1 && bytes[3] === 0) return "значок (ICO)";
    return "двоичные данные";
  }
  var TEXTUAL_EXTENSIONS = /* @__PURE__ */ new Set(["idyl", "txt", "md", "html", "css", "js", "json", "csv", "svg"]);
  function filePropsMismatchNote(path, item) {
    const name = itemName(path);
    const extensionLabel = extensionTypeLabel(name);
    if (extensionLabel === "без расширения" || extensionLabel.startsWith("неизвестное")) return null;
    const contentLabel = sniffContentType(item);
    if (!isBinaryFileItem(item)) {
      const dot = name.lastIndexOf(".");
      const extension = dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
      if (TEXTUAL_EXTENSIONS.has(extension)) return null;
    } else if (extensionLabel === contentLabel) {
      return null;
    }
    return `Расширение обещает «${extensionLabel}», а внутри — «${contentLabel}»: файл выглядит не тем, чем назван.`;
  }
  function folderSummary(path) {
    const prefix = path === WORKSPACE_ROOT ? WORKSPACE_ROOT + "/" : path + "/";
    let fileCount = 0;
    let totalSize = 0;
    let sizeKnown = true;
    for (const [file, item] of files.entries()) {
      if (!file.startsWith(prefix)) continue;
      fileCount += 1;
      const size = fileItemByteSize(item);
      if (size === null) sizeKnown = false;
      else totalSize += size;
    }
    let folderCount = 0;
    for (const folder of folders) {
      if (folder.startsWith(prefix)) folderCount += 1;
    }
    return { fileCount, folderCount, totalSize: sizeKnown ? totalSize : null };
  }
  function showFileProperties(path, type) {
    path = normalizeWorkspacePath(path);
    const rows = [];
    let title = itemName(path);
    if (type === "file") {
      const item = files.get(path);
      if (!item) {
        setStatus("Файл не найден", true);
        return;
      }
      rows.push(["Имя", itemName(path)]);
      rows.push(["Путь", studentPath(path)]);
      rows.push(["Размер", formatByteSize(fileItemByteSize(item))]);
      rows.push(["Тип по расширению", extensionTypeLabel(itemName(path))]);
      rows.push(["Истинный тип", sniffContentType(item)]);
      if (!isBinaryFileItem(item) && typeof item.content === "string") {
        rows.push(["Строк", String(item.content === "" ? 0 : item.content.split("\n").length)]);
        rows.push(["Символов", String(Array.from(item.content).length)]);
      }
    } else {
      const isRoot = path === WORKSPACE_ROOT;
      title = isRoot ? "Проект" : itemName(path);
      const summary = folderSummary(path);
      rows.push(["Имя", isRoot ? "проект (корень)" : itemName(path)]);
      if (!isRoot) rows.push(["Путь", studentPath(path)]);
      rows.push(["Файлов внутри", String(summary.fileCount)]);
      rows.push(["Папок внутри", String(summary.folderCount)]);
      rows.push(["Суммарный размер", formatByteSize(summary.totalSize)]);
    }
    filePropsModal.replaceChildren();
    const card = document.createElement("div");
    card.className = "file-props-card";
    const heading = document.createElement("h3");
    heading.className = "file-props-title";
    heading.textContent = title;
    card.appendChild(heading);
    const table = document.createElement("table");
    table.className = "file-props-table";
    for (const [label, value] of rows) {
      const row = document.createElement("tr");
      const labelCell = document.createElement("td");
      labelCell.textContent = label;
      const valueCell = document.createElement("td");
      valueCell.textContent = value;
      row.append(labelCell, valueCell);
      table.appendChild(row);
    }
    card.appendChild(table);
    if (type === "file") {
      const mismatch = filePropsMismatchNote(path, files.get(path));
      if (mismatch) {
        const note = document.createElement("p");
        note.className = "file-props-note";
        note.textContent = mismatch;
        card.appendChild(note);
      }
    }
    const actions = document.createElement("div");
    actions.className = "file-props-actions";
    const close = document.createElement("button");
    close.type = "button";
    close.textContent = "Закрыть";
    close.addEventListener("click", hideFileProperties);
    actions.appendChild(close);
    card.appendChild(actions);
    filePropsModal.appendChild(card);
    filePropsModal.hidden = false;
    close.focus();
  }
  function hideFileProperties() {
    filePropsModal.hidden = true;
  }
  function positionFileContextMenu(left, top) {
    fileContextMenu.hidden = false;
    const margin = 8;
    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = document.documentElement.clientHeight;
    const rect = fileContextMenu.getBoundingClientRect();
    fileContextMenu.style.left = clamp(left, margin, Math.max(margin, viewportWidth - rect.width - margin)) + "px";
    fileContextMenu.style.top = clamp(top, margin, Math.max(margin, viewportHeight - rect.height - margin)) + "px";
  }
  function hideFileContextMenu() {
    fileContextMenu.hidden = true;
  }
  function toggleFolder(path) {
    path = normalizeWorkspacePath(path);
    if (expandedFolders.has(path)) {
      expandedFolders.delete(path);
    } else {
      expandedFolders.add(path);
    }
    renderFiles();
    scheduleAutosave();
  }
  function projectTree() {
    const root = { type: "folder", name: "workspace", path: WORKSPACE_ROOT, children: [] };
    const nodes = /* @__PURE__ */ new Map([[WORKSPACE_ROOT, root]]);
    const ensureNodeFolder = (path) => {
      path = normalizeWorkspacePath(path);
      if (nodes.has(path)) return nodes.get(path);
      const parent = ensureNodeFolder(parentPath(path));
      const node = { type: "folder", name: basename(path), path, children: [] };
      nodes.set(path, node);
      parent.children.push(node);
      return node;
    };
    for (const folder of [...folders].sort(pathSort)) {
      if (folder !== WORKSPACE_ROOT) ensureNodeFolder(folder);
    }
    for (const [file, item] of [...files.entries()].sort(([left], [right]) => pathSort(left, right))) {
      const parent = ensureNodeFolder(parentPath(file));
      parent.children.push({
        type: "file",
        name: basename(file),
        path: file,
        kind: item.kind,
        children: []
      });
    }
    sortTreeChildren(root);
    return root;
  }
  function sortTreeChildren(node) {
    node.children.sort((left, right) => {
      if (left.type !== right.type) return left.type === "folder" ? -1 : 1;
      return left.name.localeCompare(right.name, "ru");
    });
    for (const child of node.children) {
      if (child.type === "folder") sortTreeChildren(child);
    }
  }
  function nodeIconName(node) {
    if (node.type === "folder") return expandedFolders.has(node.path) ? "folder-open" : "folder";
    if (node.kind === "asset" && isSqliteFile(node.name)) return "database";
    return node.kind === "asset" ? "asset" : "file";
  }
  function setProjectFile(path, item) {
    path = normalizeWorkspacePath(path);
    ensureParentFolders(path);
    files.set(path, item);
  }
  function addProjectFolder(path) {
    path = normalizeWorkspacePath(path);
    if (path === WORKSPACE_ROOT) return;
    const parts = shortFileName(path).split("/");
    let current = WORKSPACE_ROOT;
    for (const part of parts) {
      current = current === WORKSPACE_ROOT ? WORKSPACE_ROOT + "/" + part : current + "/" + part;
      folders.add(current);
    }
  }
  function syncFoldersFromFiles() {
    folders.add(WORKSPACE_ROOT);
    for (const file of files.keys()) ensureParentFolders(file);
  }
  function ensureParentFolders(path) {
    const parent = parentPath(path);
    if (parent !== WORKSPACE_ROOT) addProjectFolder(parent);
    folders.add(WORKSPACE_ROOT);
  }
  function validateAvailableItemPath(path) {
    path = normalizeWorkspacePath(path);
    if (path === WORKSPACE_ROOT) {
      setStatus("Нужно указать имя внутри проекта", true);
      return false;
    }
    if (files.has(path) || folders.has(path)) {
      setStatus("Такое имя уже занято", true);
      return false;
    }
    if (hasFileAncestor(path)) {
      setStatus("Внутри файла нельзя создать элемент", true);
      return false;
    }
    return true;
  }
  function uniqueCopyPath(path) {
    path = normalizeWorkspacePath(path);
    const parent = parentPath(path);
    const name = basename(path);
    const dot = name.lastIndexOf(".");
    const stem = dot > 0 ? name.slice(0, dot) : name;
    const ext = dot > 0 ? name.slice(dot) : "";
    let index = 0;
    while (true) {
      const suffix = index === 0 ? "_copy" : `_copy${index + 1}`;
      const candidate = normalizeWorkspacePath(shortFileName(parent) + "/" + stem + suffix + ext);
      if (!files.has(candidate) && !folders.has(candidate)) return candidate;
      index++;
    }
  }
  function cloneFileItem(item) {
    return {
      kind: item.kind,
      content: item.content || "",
      bytes: item.bytes instanceof Uint8Array ? new Uint8Array(item.bytes) : void 0,
      resourceUri: item.resourceUri || ""
    };
  }
  function hasFileAncestor(path) {
    let parent = parentPath(path);
    while (parent !== WORKSPACE_ROOT) {
      if (files.has(parent)) return true;
      parent = parentPath(parent);
    }
    return false;
  }
  function fallbackFilePath() {
    if (files.has(MAIN_FILE)) return MAIN_FILE;
    return [...files.keys()].sort(pathSort)[0] || MAIN_FILE;
  }
  function pathSort(left, right) {
    return left.localeCompare(right, "ru");
  }
  function snapshotDroppedEntries(dataTransfer) {
    const items = dataTransfer && dataTransfer.items;
    if (!items) return null;
    const entries = [];
    for (const item of items) {
      if (item.kind !== "file") continue;
      const entry = typeof item.webkitGetAsEntry === "function" ? item.webkitGetAsEntry() : null;
      if (entry) entries.push(entry);
    }
    return entries.length > 0 ? entries : null;
  }
  async function loadDroppedTransfer(entries, plainFiles) {
    if (!entries || !entries.some((entry) => entry.isDirectory)) {
      await loadDroppedFiles(plainFiles);
      return;
    }
    const collected = [];
    const folderPaths = [];
    const walk = async (entry, prefix) => {
      if (entry.isFile) {
        const file = await new Promise((resolve, reject) => entry.file(resolve, reject));
        collected.push({ file, path: prefix + file.name });
        return;
      }
      if (!entry.isDirectory) return;
      const folderPath = prefix + entry.name;
      folderPaths.push(folderPath);
      const reader = entry.createReader();
      while (true) {
        const batch = await new Promise((resolve, reject) => reader.readEntries(resolve, reject));
        if (batch.length === 0) break;
        for (const child of batch) await walk(child, folderPath + "/");
      }
    };
    for (const entry of entries) await walk(entry, "");
    saveCurrentEditor();
    for (const folderPath of folderPaths) {
      const normalized = normalizeWorkspacePath(folderPath);
      addProjectFolder(normalized);
      expandedFolders.add(normalized);
    }
    let lastPath = null;
    let loadedCurrentFile = false;
    let loadedCount = 0;
    let skippedCount = 0;
    for (const item of collected) {
      const loadedPath = await loadExternalFile(item.file, item.path);
      if (loadedPath) {
        if (loadedPath === currentFile) loadedCurrentFile = true;
        lastPath = loadedPath;
        loadedCount++;
      } else {
        skippedCount++;
      }
    }
    hideUploadMenu();
    if (loadedCurrentFile) editorReady = false;
    if (lastPath) openFile(lastPath);
    else renderFiles();
    scheduleAutosave();
    const skippedText = skippedCount > 0 ? `, пропущено: ${skippedCount}` : "";
    setStatus(`Загружено файлов: ${loadedCount} (папок: ${folderPaths.length})${skippedText}`);
  }
  async function loadDroppedFiles(fileList2) {
    const selected = Array.from(fileList2 || []);
    if (selected.length === 0) return;
    saveCurrentEditor();
    let lastPath = null;
    let loadedCurrentFile = false;
    let loadedCount = 0;
    let skippedCount = 0;
    for (const file of selected) {
      const loadedPath = await loadExternalFile(file);
      if (loadedPath) {
        if (loadedPath === currentFile) loadedCurrentFile = true;
        lastPath = loadedPath;
        loadedCount++;
      } else {
        skippedCount++;
      }
    }
    hideUploadMenu();
    if (loadedCurrentFile) editorReady = false;
    if (lastPath) openFile(lastPath);
    scheduleAutosave();
    const skippedText = skippedCount > 0 ? `, пропущено: ${skippedCount}` : "";
    setStatus(`Загружено файлов: ${loadedCount}${skippedText}`);
  }
  async function loadExternalFile(file, explicitPath) {
    if (file.name.toLowerCase().endsWith(".zip")) {
      try {
        return importProjectZip(new Uint8Array(await file.arrayBuffer()));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        appendOutput(`ZIP «${file.name}» не импортирован: ${message}`, "output-error");
        setStatus(`ZIP не импортирован`, true);
        return null;
      }
    }
    const path = normalizeWorkspacePath(explicitPath || file.webkitRelativePath || file.name);
    if (path === WORKSPACE_ROOT || folders.has(path) || hasFileAncestor(path)) {
      setStatus(`Нельзя загрузить файл по пути «${shortFileName(path) || path}»`, true);
      return null;
    }
    if (files.has(path) && !await requestUploadReplacement(path)) return null;
    if (isEditableTextFile(file)) {
      setProjectFile(path, {
        kind: "text",
        content: await readFileAsText(file)
      });
      return path;
    }
    setProjectFile(path, {
      kind: "asset",
      content: "",
      bytes: new Uint8Array(await file.arrayBuffer()),
      resourceUri: await readFileAsDataUrl(file)
    });
    return path;
  }
  async function downloadProject() {
    try {
      await flushCurrentProjectState();
      await downloadProjectState(serializeProjectState(), currentProjectName);
      setStatus("Проект скачан");
    } catch (error) {
      setStatus("Не удалось скачать проект", true);
      appendOutput(formatThrownError(error), "output-error");
    }
  }
  function downloadProjectFile(path) {
    path = normalizeWorkspacePath(path);
    if (path === currentFile) saveCurrentEditor();
    const item = files.get(path);
    if (!item) {
      setStatus("Файл не найден", true);
      return;
    }
    const bytes = item.kind === "asset" ? assetBytes(item) : new TextEncoder().encode(item.content || "");
    const mime = item.kind === "asset" ? detectAssetMimeType(path, bytes) : `${mimeTypeForFile(path)};charset=utf-8`;
    downloadBlob(new Blob([bytes], { type: mime }), basename(path));
    setStatus("Файл скачан");
  }
  async function downloadStoredProject(projectId) {
    const entry = projectCatalog.find((project) => project.id === projectId);
    if (!entry) throw new Error("Проект не найден");
    if (projectId === currentProjectId) {
      await downloadProject();
      return;
    }
    const state = await readProjectDbValue(projectRecordKey(projectId));
    if (!state || !Array.isArray(state.files)) throw new Error(`Не удалось прочитать проект «${entry.name}»`);
    await downloadProjectState(state, entry.name);
    setStatus("Проект скачан");
  }
  async function downloadProjectState(state, name) {
    const blob = await createProjectZip(state);
    downloadBlob(blob, `${safeDownloadName(name)}.zip`);
  }
  function downloadBlob(blob, name) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1e3);
  }
  function safeDownloadName(value) {
    const cleaned = String(value || "").replace(/[\\/:*?"<>|]/gu, "_").replace(/[.\s]+$/gu, "").trim().slice(0, 80);
    return cleaned || "idyllium-project";
  }
  async function createProjectZip(state = serializeProjectState()) {
    const entries = [];
    const stateFolders = Array.isArray(state.folders) ? state.folders : [];
    const stateFiles = Array.isArray(state.files) ? state.files : [];
    for (const folder of stateFolders.map((path) => normalizeWorkspacePath(path)).filter((path) => path !== WORKSPACE_ROOT).sort(pathSort)) {
      entries.push({ name: shortFileName(folder) + "/", bytes: new Uint8Array() });
    }
    for (const item of [...stateFiles].sort((left, right) => String(left.path).localeCompare(String(right.path)))) {
      const name = shortFileName(item.path);
      const bytes = item.kind === "asset" ? assetBytes(item) : new TextEncoder().encode(item.content || "");
      entries.push({ name, bytes });
    }
    return new Blob([zipBytes(entries)], { type: "application/zip" });
  }
  function importProjectZip(bytes) {
    const entries = unzipEntries(bytes);
    if (entries.length === 0) throw new Error("ZIP-архив не содержит файлов");
    saveCurrentEditor();
    stopProgram(true);
    files.clear();
    folders.clear();
    folders.add(WORKSPACE_ROOT);
    expandedFolders.clear();
    expandedFolders.add(WORKSPACE_ROOT);
    let firstPath = null;
    for (const entry of entries) {
      const path = normalizeWorkspacePath(entry.name);
      if (entry.directory) {
        addProjectFolder(path);
        continue;
      }
      if (!firstPath) firstPath = path;
      if (isEditableTextName(entry.name)) {
        setProjectFile(path, {
          kind: "text",
          content: new TextDecoder("utf-8").decode(entry.bytes)
        });
      } else {
        setProjectFile(path, {
          kind: "asset",
          content: "",
          bytes: entry.bytes,
          resourceUri: bytesToDataUrl(entry.name, entry.bytes)
        });
      }
    }
    editorReady = false;
    if (files.size === 0) setProjectFile(MAIN_FILE, { kind: "text", content: "" });
    currentFile = files.has(MAIN_FILE) ? MAIN_FILE : firstPath || MAIN_FILE;
    renderFiles();
    postEmptySnapshot();
    setStatus("Проект импортирован из ZIP");
    return currentFile;
  }
  function applySavedLayout() {
    try {
      const saved = JSON.parse(window.localStorage.getItem(LAYOUT_STORAGE_KEY) || "{}");
      if (typeof saved.filesWidth === "number") workspace.style.setProperty("--files-width", `${saved.filesWidth}px`);
      if (typeof saved.runtimeWidth === "number") workspace.style.setProperty("--runtime-width", `${saved.runtimeWidth}px`);
      if (typeof saved.outputHeight === "number") runtimePane.style.setProperty("--output-height", `${saved.outputHeight}px`);
    } catch (_error) {
    }
  }
  function installColumnResizers() {
    for (const resizer of document.querySelectorAll(".column-resizer")) {
      resizer.addEventListener("pointerdown", (event) => {
        const target = event.currentTarget;
        if (!(target instanceof HTMLElement)) return;
        target.setPointerCapture(event.pointerId);
        target.classList.add("dragging");
        const type = target.dataset.resizer;
        const onMove = (moveEvent) => {
          const rect = workspace.getBoundingClientRect();
          const current = currentLayoutWidths();
          const minFiles = 150;
          const minEditor = 280;
          const minRuntime = 300;
          if (type === "files") {
            const maxFiles = rect.width - current.runtimeWidth - minEditor - 12;
            const filesWidth = clamp(moveEvent.clientX - rect.left, minFiles, Math.max(minFiles, maxFiles));
            workspace.style.setProperty("--files-width", `${filesWidth}px`);
          }
          if (type === "runtime") {
            const maxRuntime = rect.width - current.filesWidth - minEditor - 12;
            const runtimeWidth = clamp(rect.right - moveEvent.clientX, minRuntime, Math.max(minRuntime, maxRuntime));
            workspace.style.setProperty("--runtime-width", `${runtimeWidth}px`);
          }
        };
        const onUp = () => {
          target.classList.remove("dragging");
          target.releasePointerCapture(event.pointerId);
          window.removeEventListener("pointermove", onMove);
          window.removeEventListener("pointerup", onUp);
          saveLayoutWidths();
        };
        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
        event.preventDefault();
      });
    }
  }
  function installRuntimeRowResizer() {
    if (!runtimeRowResizer || !runtimePane) return;
    runtimeRowResizer.addEventListener("pointerdown", (event) => {
      runtimeRowResizer.setPointerCapture(event.pointerId);
      runtimeRowResizer.classList.add("dragging");
      const onMove = (moveEvent) => {
        const rect = runtimePane.getBoundingClientRect();
        const minOutput = 90;
        const minPreview = 160;
        const maxOutput = Math.max(minOutput, rect.height - minPreview - 6);
        const outputHeight = clamp(moveEvent.clientY - rect.top, minOutput, maxOutput);
        runtimePane.style.setProperty("--output-height", `${outputHeight}px`);
      };
      const onUp = () => {
        runtimeRowResizer.classList.remove("dragging");
        runtimeRowResizer.releasePointerCapture(event.pointerId);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        saveLayoutWidths();
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      event.preventDefault();
    });
  }
  function currentLayoutWidths() {
    const columns = getComputedStyle(workspace).gridTemplateColumns.split(/\s+/u).map((value) => Number.parseFloat(value));
    const rows = runtimePane ? getComputedStyle(runtimePane).gridTemplateRows.split(/\s+/u).map((value) => Number.parseFloat(value)) : [];
    return {
      filesWidth: columns[0] || 220,
      runtimeWidth: columns[4] || Math.max(300, workspace.getBoundingClientRect().width * 0.42),
      outputHeight: rows[0] || Math.max(120, (runtimePane?.getBoundingClientRect().height || 400) * 0.32)
    };
  }
  function saveLayoutWidths() {
    const current = currentLayoutWidths();
    window.localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(current));
  }
  function scheduleAutosave() {
    if (!currentProjectId) return;
    if (saveTimer !== null) window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => {
      saveTimer = null;
      saveProjectState().catch((error) => {
        setStatus("Автосохранение не удалось", true);
        appendOutput(formatThrownError(error), "output-error");
      });
    }, AUTOSAVE_DELAY_MS);
  }
  async function saveProjectState() {
    if (!currentProjectId) return;
    const projectId = currentProjectId;
    const state = serializeProjectState();
    const updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    state.savedAt = updatedAt;
    projectCatalog = projectCatalog.map((entry) => entry.id === projectId ? { ...entry, updatedAt } : entry);
    const catalog = serializeProjectCatalog();
    await enqueueProjectWrite(() => writeProjectDbBatch([
      [projectRecordKey(projectId), state],
      [PROJECT_CATALOG_KEY, catalog]
    ]));
  }
  async function forceSaveCurrentProject() {
    try {
      await flushCurrentProjectState();
      setStatus("Проект сохранён");
    } catch (error) {
      setStatus("Не удалось сохранить проект", true);
      appendOutput(formatThrownError(error), "output-error");
    }
  }
  async function flushCurrentProjectState() {
    syncRuntimeFilesFromSnapshot();
    saveCurrentEditor();
    if (saveTimer !== null) {
      window.clearTimeout(saveTimer);
      saveTimer = null;
    }
    await saveProjectState();
    await projectWriteQueue;
  }
  function enqueueProjectWrite(task) {
    const result = projectWriteQueue.then(task, task);
    projectWriteQueue = result.catch(() => {
    });
    return result;
  }
  async function initializeProjectStorage() {
    const storedCatalog = await readProjectDbValue(PROJECT_CATALOG_KEY);
    const legacyState = await readProjectDbValue(PROJECT_STATE_KEY);
    projectCatalog = normalizeProjectCatalog(storedCatalog);
    if (projectCatalog.length === 0) {
      const projectId = createProjectId();
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const state2 = legacyState && !isLegacyDefaultCanvasProject(legacyState) ? copySerializedProjectState(legacyState) : createDefaultProjectState();
      state2.savedAt = now;
      projectCatalog = [{
        id: projectId,
        name: DEFAULT_PROJECT_NAME,
        createdAt: now,
        updatedAt: now
      }];
      await writeProjectDbBatch([
        [projectRecordKey(projectId), state2],
        [PROJECT_CATALOG_KEY, serializeProjectCatalog()]
      ], [PROJECT_STATE_KEY]);
    } else if (legacyState) {
      await writeProjectDbBatch([], [PROJECT_STATE_KEY]);
    }
    const preferredId = window.localStorage.getItem(LAST_PROJECT_STORAGE_KEY);
    const preferred = projectCatalog.find((entry) => entry.id === preferredId);
    const selected = preferred || [...projectCatalog].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];
    currentProjectId = selected.id;
    currentProjectName = selected.name;
    window.localStorage.setItem(LAST_PROJECT_STORAGE_KEY, currentProjectId);
    let state = await readProjectDbValue(projectRecordKey(currentProjectId));
    if (!state || !Array.isArray(state.files)) {
      state = createDefaultProjectState();
      await writeProjectDbBatch([
        [projectRecordKey(currentProjectId), state],
        [PROJECT_CATALOG_KEY, serializeProjectCatalog()]
      ]);
    }
    return state;
  }
  function createDefaultProjectState() {
    return {
      version: 2,
      currentFile: MAIN_FILE,
      savedAt: (/* @__PURE__ */ new Date()).toISOString(),
      folders: [],
      expandedFolders: [],
      files: [
        {
          path: MAIN_FILE,
          kind: "text",
          content: [
            "use console;",
            "",
            "main() {",
            `    console.write("Hello, World!", '\\n');`,
            "}"
          ].join("\n"),
          bytes: null,
          resourceUri: ""
        }
      ]
    };
  }
  function copySerializedProjectState(state) {
    return {
      version: 2,
      currentFile: typeof state.currentFile === "string" ? state.currentFile : MAIN_FILE,
      savedAt: (/* @__PURE__ */ new Date()).toISOString(),
      folders: Array.isArray(state.folders) ? [...state.folders] : [],
      expandedFolders: Array.isArray(state.expandedFolders) ? [...state.expandedFolders] : [],
      files: Array.isArray(state.files) ? state.files.map((entry) => ({
        path: entry.path,
        kind: entry.kind,
        content: entry.content || "",
        bytes: entry.bytes ? new Uint8Array(entry.bytes) : null,
        resourceUri: entry.resourceUri || ""
      })) : []
    };
  }
  function normalizeProjectCatalog(value) {
    if (!value || !Array.isArray(value.projects)) return [];
    const seen = /* @__PURE__ */ new Set();
    const result = [];
    for (const raw of value.projects) {
      const id = typeof raw.id === "string" ? raw.id.trim() : "";
      if (!id || seen.has(id)) continue;
      seen.add(id);
      const createdAt = validIsoDate(raw.createdAt) || (/* @__PURE__ */ new Date()).toISOString();
      result.push({
        id,
        name: normalizeStoredProjectName(raw.name),
        createdAt,
        updatedAt: validIsoDate(raw.updatedAt) || createdAt
      });
    }
    return result;
  }
  function serializeProjectCatalog() {
    return {
      version: 1,
      projects: projectCatalog.map((entry) => ({ ...entry }))
    };
  }
  function validIsoDate(value) {
    if (typeof value !== "string" || Number.isNaN(Date.parse(value))) return "";
    return value;
  }
  function normalizeStoredProjectName(value) {
    const name = typeof value === "string" ? value.trim() : "";
    return name || DEFAULT_PROJECT_NAME;
  }
  function createProjectId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") return window.crypto.randomUUID();
    return `project-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
  function projectRecordKey(projectId) {
    return PROJECT_RECORD_PREFIX + projectId;
  }
  async function readProjectDbValue(key) {
    const db = await openProjectDb();
    try {
      return await idbRequest(db.transaction(PROJECT_DB_STORE, "readonly").objectStore(PROJECT_DB_STORE).get(key));
    } finally {
      db.close();
    }
  }
  async function writeProjectDbBatch(entries, deleteKeys = []) {
    const db = await openProjectDb();
    try {
      const transaction = db.transaction(PROJECT_DB_STORE, "readwrite");
      const completed = idbTransaction(transaction);
      const store = transaction.objectStore(PROJECT_DB_STORE);
      for (const [key, value] of entries) store.put(value, key);
      for (const key of deleteKeys) store.delete(key);
      await completed;
    } finally {
      db.close();
    }
  }
  function idbTransaction(transaction) {
    return new Promise((resolve, reject) => {
      transaction.addEventListener("complete", () => resolve());
      transaction.addEventListener("abort", () => reject(transaction.error || new Error("IndexedDB transaction aborted")));
      transaction.addEventListener("error", () => reject(transaction.error || new Error("IndexedDB transaction failed")));
    });
  }
  function serializeProjectState() {
    syncFoldersFromFiles();
    return {
      version: 2,
      currentFile,
      savedAt: (/* @__PURE__ */ new Date()).toISOString(),
      folders: [...folders].filter((path) => path !== WORKSPACE_ROOT).sort(pathSort),
      expandedFolders: [...expandedFolders].filter((path) => path !== WORKSPACE_ROOT).sort(pathSort),
      files: [...files.entries()].map(([path, item]) => ({
        path,
        kind: item.kind,
        content: item.content || "",
        bytes: item.bytes instanceof Uint8Array ? new Uint8Array(item.bytes) : null,
        resourceUri: item.resourceUri || ""
      }))
    };
  }
  function restoreProjectState(state) {
    if (!state || !Array.isArray(state.files)) return;
    structuredViewModes.clear();
    csvHeaderModes.clear();
    files.clear();
    folders.clear();
    folders.add(WORKSPACE_ROOT);
    expandedFolders.clear();
    expandedFolders.add(WORKSPACE_ROOT);
    if (Array.isArray(state.folders)) {
      for (const folder of state.folders) addProjectFolder(folder);
    }
    if (Array.isArray(state.expandedFolders)) {
      for (const folder of state.expandedFolders) expandedFolders.add(normalizeWorkspacePath(folder));
    }
    for (const entry of state.files) {
      const path = normalizeWorkspacePath(entry.path || "");
      if (!path || path === WORKSPACE_ROOT) continue;
      if (entry.kind === "asset") {
        setProjectFile(path, {
          kind: "asset",
          content: entry.content || "",
          bytes: entry.bytes ? new Uint8Array(entry.bytes) : void 0,
          resourceUri: entry.resourceUri || ""
        });
      } else {
        setProjectFile(path, {
          kind: "text",
          content: entry.content || ""
        });
      }
    }
    if (files.size === 0) {
      setProjectFile(MAIN_FILE, { kind: "text", content: "" });
    }
    currentFile = typeof state.currentFile === "string" ? normalizeWorkspacePath(state.currentFile) : MAIN_FILE;
  }
  function isLegacyDefaultCanvasProject(state) {
    if (!state || !Array.isArray(state.files)) return false;
    const main = state.files.find((entry) => normalizeWorkspacePath(entry.path || "") === MAIN_FILE);
    if (!main || typeof main.content !== "string") return false;
    return main.content.includes('win.title = "Idyllium Canvas";') && main.content.includes('title.text = "Привет, Canvas!";') && main.content.includes("drawable.Rectangle rect;");
  }
  function openProjectDb() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) {
        reject(new Error("IndexedDB недоступен в этом браузере"));
        return;
      }
      const request = window.indexedDB.open(PROJECT_DB_NAME, 1);
      request.addEventListener("upgradeneeded", () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(PROJECT_DB_STORE)) db.createObjectStore(PROJECT_DB_STORE);
      });
      request.addEventListener("success", () => resolve(request.result));
      request.addEventListener("error", () => reject(request.error || new Error("IndexedDB open failed")));
    });
  }
  function idbRequest(request) {
    return new Promise((resolve, reject) => {
      request.addEventListener("success", () => resolve(request.result));
      request.addEventListener("error", () => reject(request.error || new Error("IndexedDB request failed")));
    });
  }
  async function createNewProject(name) {
    stopProgram(true);
    await flushCurrentProjectState();
    await storeAndActivateNewProject(name, createDefaultProjectState());
  }
  async function duplicateCurrentProject(name) {
    stopProgram(true);
    await flushCurrentProjectState();
    await storeAndActivateNewProject(name, serializeProjectState());
  }
  async function storeAndActivateNewProject(name, sourceState) {
    const error = projectNameError(name);
    if (error) throw new Error(error);
    const projectId = createProjectId();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const state = copySerializedProjectState(sourceState);
    state.savedAt = now;
    const entry = {
      id: projectId,
      name: name.trim(),
      createdAt: now,
      updatedAt: now
    };
    projectCatalog = [...projectCatalog, entry];
    await enqueueProjectWrite(() => writeProjectDbBatch([
      [projectRecordKey(projectId), state],
      [PROJECT_CATALOG_KEY, serializeProjectCatalog()]
    ]));
    activateProject(entry, state);
    setStatus("Проект создан");
  }
  async function switchProject(projectId) {
    if (projectId === currentProjectId) {
      hideFileAppMenu();
      return;
    }
    stopProgram(true);
    await flushCurrentProjectState();
    const entry = projectCatalog.find((item) => item.id === projectId);
    if (!entry) throw new Error("Проект не найден");
    const state = await readProjectDbValue(projectRecordKey(projectId));
    if (!state || !Array.isArray(state.files)) throw new Error(`Не удалось прочитать проект «${entry.name}»`);
    activateProject(entry, state);
    setStatus("Проект открыт");
  }
  function activateProject(entry, state) {
    stopProgram(true);
    fileEditState = null;
    editorReady = false;
    disposeProjectMonacoModels();
    currentProjectId = entry.id;
    currentProjectName = entry.name;
    window.localStorage.setItem(LAST_PROJECT_STORAGE_KEY, currentProjectId);
    restoreProjectState(copySerializedProjectState(state));
    if (!files.has(currentFile)) currentFile = fallbackFilePath();
    renderFiles();
    openFile(currentFile);
    setOutputText("");
    postEmptySnapshot();
    updateCurrentProjectUi();
    hideFileAppMenu();
  }
  function disposeProjectMonacoModels() {
    if (!monacoReady || !window.monaco) return;
    if (monacoEditor) monacoEditor.setModel(null);
    for (const model of window.monaco.editor.getModels()) {
      if (model.uri.scheme === "file" && model.uri.path.startsWith(WORKSPACE_ROOT + "/")) model.dispose();
    }
  }
  async function deleteCurrentProject() {
    const deletedId = currentProjectId;
    stopProgram(true);
    await flushCurrentProjectState();
    projectCatalog = projectCatalog.filter((entry) => entry.id !== deletedId);
    let nextEntry = [...projectCatalog].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];
    let nextState;
    const writes = [];
    if (!nextEntry) {
      const now = (/* @__PURE__ */ new Date()).toISOString();
      nextEntry = {
        id: createProjectId(),
        name: DEFAULT_PROJECT_NAME,
        createdAt: now,
        updatedAt: now
      };
      nextState = createDefaultProjectState();
      projectCatalog = [nextEntry];
      writes.push([projectRecordKey(nextEntry.id), nextState]);
    } else {
      nextState = await readProjectDbValue(projectRecordKey(nextEntry.id));
      if (!nextState || !Array.isArray(nextState.files)) {
        nextState = createDefaultProjectState();
        writes.push([projectRecordKey(nextEntry.id), nextState]);
      }
    }
    writes.push([PROJECT_CATALOG_KEY, serializeProjectCatalog()]);
    await enqueueProjectWrite(() => writeProjectDbBatch(writes, [projectRecordKey(deletedId)]));
    activateProject(nextEntry, nextState);
    setStatus("Проект удалён");
  }
  function projectNameError(value, ignoredProjectId = "") {
    const name = String(value || "").trim();
    if (!name) return "Введите название проекта";
    if (name.length > 80) return "Название не должно быть длиннее 80 символов";
    if (/[\u0000-\u001F\u007F]/u.test(name)) return "В названии есть недопустимые управляющие символы";
    const duplicate = projectCatalog.some((entry) => entry.id !== ignoredProjectId && entry.name.localeCompare(name, "ru", { sensitivity: "accent" }) === 0);
    if (duplicate) return "Проект с таким названием уже существует";
    return "";
  }
  function uniqueProjectName(base) {
    const initial = String(base || DEFAULT_PROJECT_NAME).trim() || DEFAULT_PROJECT_NAME;
    if (!projectNameError(initial)) return initial;
    let index = 2;
    while (projectNameError(`${initial} ${index}`)) index += 1;
    return `${initial} ${index}`;
  }
  function updateCurrentProjectUi() {
    if (currentProjectNameElement) currentProjectNameElement.textContent = currentProjectName;
    if (fileAppMenuButton) fileAppMenuButton.title = `Файл · ${currentProjectName}`;
    document.title = `${currentProjectName} · Idyllium Web IDE`;
  }
  function toggleUploadMenu() {
    uploadMenu.hidden ? showUploadMenu() : hideUploadMenu();
  }
  function showUploadMenu() {
    hideFileAppMenu();
    hideEditAppMenu();
    hideThemeMenu();
    hideColorPickerMenu();
    uploadMenu.hidden = false;
    uploadButton.setAttribute("aria-expanded", "true");
  }
  function hideUploadMenu() {
    resolveUploadConflict(false);
    uploadMenu.hidden = true;
    uploadButton.setAttribute("aria-expanded", "false");
    dropArea.classList.remove("drag-over");
  }
  function requestUploadReplacement(path) {
    showUploadMenu();
    dropArea.hidden = true;
    uploadConflict.hidden = false;
    uploadConflictName.textContent = shortFileName(path);
    return new Promise((resolve) => {
      pendingUploadConflictResolve = resolve;
      uploadConflictReplace.focus();
    });
  }
  function resolveUploadConflict(replace) {
    const resolve = pendingUploadConflictResolve;
    pendingUploadConflictResolve = null;
    uploadConflict.hidden = true;
    dropArea.hidden = false;
    if (resolve) resolve(replace);
  }
  function installDropArea() {
    for (const eventName of ["dragenter", "dragover"]) {
      dropArea.addEventListener(eventName, (event) => {
        event.preventDefault();
        dropArea.classList.add("drag-over");
      });
    }
    for (const eventName of ["dragleave", "drop"]) {
      dropArea.addEventListener(eventName, (event) => {
        event.preventDefault();
        dropArea.classList.remove("drag-over");
      });
    }
    dropArea.addEventListener("drop", (event) => {
      const entries = snapshotDroppedEntries(event.dataTransfer);
      loadDroppedTransfer(entries, event.dataTransfer && event.dataTransfer.files);
    });
    let fileListDragDepth = 0;
    fileList.addEventListener("dragenter", (event) => {
      if (!isFileTransfer(event.dataTransfer)) return;
      event.preventDefault();
      fileListDragDepth += 1;
      fileList.classList.add("drag-over");
    });
    fileList.addEventListener("dragover", (event) => {
      if (!isFileTransfer(event.dataTransfer)) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
      fileList.classList.add("drag-over");
    });
    fileList.addEventListener("dragleave", (event) => {
      if (!isFileTransfer(event.dataTransfer)) return;
      event.preventDefault();
      fileListDragDepth = Math.max(0, fileListDragDepth - 1);
      if (fileListDragDepth === 0) fileList.classList.remove("drag-over");
    });
    fileList.addEventListener("drop", (event) => {
      if (!isFileTransfer(event.dataTransfer)) return;
      event.preventDefault();
      fileListDragDepth = 0;
      fileList.classList.remove("drag-over");
      const entries = snapshotDroppedEntries(event.dataTransfer);
      loadDroppedTransfer(entries, event.dataTransfer && event.dataTransfer.files);
    });
    fileList.addEventListener("dragover", (event) => {
      if (!internalDragPath) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
    });
    fileList.addEventListener("drop", (event) => {
      if (!internalDragPath) return;
      event.preventDefault();
      const dragged = internalDragPath;
      const draggedType = internalDragType;
      internalDragPath = null;
      clearMoveTargetHighlight();
      moveProjectItemTo(dragged, draggedType, WORKSPACE_ROOT);
    });
  }
  function isFileTransfer(dataTransfer) {
    if (!dataTransfer) return false;
    const types = Array.from(dataTransfer.types || []);
    return types.length === 0 || types.includes("Files");
  }
  function handleEditorKeydown(event) {
    if (event.ctrlKey && event.key === "Enter") {
      runProgram();
      event.preventDefault();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.code === "Space") {
      refreshCompletions(true);
      event.preventDefault();
      return;
    }
    if (event.key === "Escape" && !completionPopup.hidden) {
      hideCompletions();
      event.preventDefault();
      return;
    }
    if (!completionPopup.hidden && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
      moveCompletion(event.key === "ArrowDown" ? 1 : -1);
      event.preventDefault();
      return;
    }
    if (!completionPopup.hidden && (event.key === "Enter" || event.key === "Tab")) {
      acceptCompletion();
      event.preventDefault();
      return;
    }
    if (event.key === "Tab") {
      insertText("    ");
      hideCompletions();
      event.preventDefault();
    }
  }
  function refreshCompletions(manual) {
    if (!currentFile.endsWith(".idyl") || editor.disabled) {
      hideCompletions();
      return;
    }
    const token = completionToken();
    if (!manual && !token.afterDot && token.prefix.length < 2) {
      hideCompletions();
      return;
    }
    let items = [];
    try {
      const project = new window.Idyllium.IdylliumProject({
        entryFile: MAIN_FILE,
        files: textSourceMap()
      });
      items = project.completions({
        file: currentFile,
        offset: token.requestOffset
      });
    } catch (_error) {
      hideCompletions();
      return;
    }
    if (token.prefix) {
      const prefix = token.prefix.toLowerCase();
      items = items.filter((item) => item.name.toLowerCase().startsWith(prefix));
    }
    completionItems = deduplicateCompletions(items).slice(0, 40);
    completionStart = token.start;
    completionIndex = 0;
    if (completionItems.length === 0) {
      hideCompletions();
      return;
    }
    renderCompletions();
  }
  function completionToken() {
    const offset = editor.selectionStart;
    const prefix = editor.value.slice(0, offset);
    const memberMatch = /[\p{L}\p{N}_\])"']\s*\.\s*([A-Za-z_А-Яа-яЁё][A-Za-z0-9_А-Яа-яЁё]*)?$/u.exec(prefix);
    if (memberMatch) {
      const word2 = memberMatch[1] || "";
      return {
        afterDot: true,
        prefix: word2,
        requestOffset: offset - word2.length,
        start: offset - word2.length
      };
    }
    const wordMatch = /([A-Za-z_А-Яа-яЁё][A-Za-z0-9_А-Яа-яЁё]*)$/u.exec(prefix);
    const word = wordMatch ? wordMatch[1] : "";
    return {
      afterDot: false,
      prefix: word,
      requestOffset: offset,
      start: offset - word.length
    };
  }
  function renderCompletions() {
    completionPopup.replaceChildren();
    completionItems.forEach((item, index) => {
      const row = document.createElement("div");
      row.className = "completion-item" + (index === completionIndex ? " active" : "");
      row.addEventListener("mousedown", (event) => {
        completionIndex = index;
        acceptCompletion();
        event.preventDefault();
      });
      const name = document.createElement("span");
      name.textContent = item.name;
      row.appendChild(name);
      const detail = document.createElement("span");
      detail.className = "completion-detail";
      detail.textContent = item.detail || item.kind || "";
      row.appendChild(detail);
      completionPopup.appendChild(row);
    });
    const position = cursorPopupPosition();
    completionPopup.style.left = position.left + "px";
    completionPopup.style.top = position.top + "px";
    completionPopup.hidden = false;
  }
  function moveCompletion(delta) {
    completionIndex = (completionIndex + delta + completionItems.length) % completionItems.length;
    renderCompletions();
  }
  function acceptCompletion() {
    const item = completionItems[completionIndex];
    if (!item) return;
    const end = editor.selectionStart;
    editor.setRangeText(item.name, completionStart, end, "end");
    saveCurrentEditor();
    updateEditorVisuals();
    hideCompletions();
  }
  function hideCompletions() {
    completionPopup.hidden = true;
    completionItems = [];
  }
  function cursorPopupPosition() {
    const before = editor.value.slice(0, editor.selectionStart);
    const lines = before.split("\n");
    const line = lines.length - 1;
    const column = Array.from(lines[lines.length - 1]).length;
    return {
      left: Math.max(8, 14 + column * editorCharWidth(editorFontSize) - editor.scrollLeft),
      top: Math.max(8, 14 + (line + 1) * editorLineHeight(editorFontSize) - editor.scrollTop)
    };
  }
  function insertText(text) {
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    editor.setRangeText(text, start, end, "end");
    saveCurrentEditor();
    updateEditorVisuals();
  }
  function toggleFileAppMenu() {
    fileAppMenu.hidden ? showFileAppMenu() : hideFileAppMenu();
  }
  function showFileAppMenu() {
    hideEditAppMenu();
    hideUploadMenu();
    hideThemeMenu();
    hideColorPickerMenu();
    hideFileContextMenu();
    resetFileAppMenu();
    updateCurrentProjectUi();
    fileAppMenu.hidden = false;
    fileAppMenuButton.setAttribute("aria-expanded", "true");
  }
  function hideFileAppMenu() {
    if (!fileAppMenu) return;
    fileAppMenu.hidden = true;
    fileAppMenuButton.setAttribute("aria-expanded", "false");
    resetFileAppMenu();
  }
  function resetFileAppMenu() {
    if (!fileAppMenuMain || !fileAppMenuPanel) return;
    fileAppMenuMain.hidden = false;
    fileAppMenuPanel.hidden = true;
    fileAppMenuPanel.replaceChildren();
  }
  function handleFileAppMenuClick(event) {
    if (!(event.target instanceof Element)) return;
    const button = event.target.closest("[data-file-command]");
    if (!button || !fileAppMenu.contains(button)) return;
    const command = button.dataset.fileCommand;
    executeFileAppCommand(command).catch(reportProjectOperationError);
  }
  async function executeFileAppCommand(command) {
    if (command === "new-file") {
      hideFileAppMenu();
      startCreateItemInline("file", WORKSPACE_ROOT);
      return;
    }
    if (command === "open-file") {
      hideFileAppMenu();
      uploadInput.click();
      return;
    }
    if (command === "new-project") {
      showProjectNamePanel({
        title: "Новый проект",
        initialValue: uniqueProjectName("Новый проект"),
        submitLabel: "Создать",
        submit: createNewProject
      });
      return;
    }
    if (command === "open-project") {
      showProjectListPanel("Открыть проект", projectCatalog, switchProject, true);
      return;
    }
    if (command === "save-project") {
      hideFileAppMenu();
      await forceSaveCurrentProject();
      return;
    }
    if (command === "duplicate-project") {
      showProjectNamePanel({
        title: "Дублировать проект",
        initialValue: uniqueProjectName(`${currentProjectName} (копия)`),
        submitLabel: "Дублировать",
        submit: duplicateCurrentProject
      });
      return;
    }
    if (command === "delete-project") {
      showDeleteProjectPanel();
      return;
    }
    if (command === "download-project") {
      hideFileAppMenu();
      await downloadProject();
      return;
    }
    if (command === "download-other-project") {
      showProjectListPanel(
        "Скачать другой проект",
        projectCatalog.filter((entry) => entry.id !== currentProjectId),
        async (projectId) => {
          await downloadStoredProject(projectId);
          hideFileAppMenu();
        },
        false
      );
    }
  }
  function showProjectNamePanel(options) {
    showFileAppMenuPanel(options.title);
    const form = document.createElement("form");
    form.className = "app-menu-form";
    const label = document.createElement("label");
    label.className = "app-menu-panel-label";
    label.textContent = "Название проекта";
    form.appendChild(label);
    const input = document.createElement("input");
    input.type = "text";
    input.maxLength = 80;
    input.value = options.initialValue;
    input.autocomplete = "off";
    label.htmlFor = "project-name-input";
    input.id = "project-name-input";
    form.appendChild(input);
    const error = document.createElement("p");
    error.className = "app-menu-error";
    error.setAttribute("aria-live", "polite");
    form.appendChild(error);
    const actions = document.createElement("div");
    actions.className = "app-menu-form-actions";
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.textContent = "Отмена";
    cancel.addEventListener("click", resetFileAppMenu);
    actions.appendChild(cancel);
    const submit = document.createElement("button");
    submit.type = "submit";
    submit.className = "primary";
    submit.textContent = options.submitLabel;
    actions.appendChild(submit);
    form.appendChild(actions);
    fileAppMenuPanel.appendChild(form);
    input.addEventListener("input", () => {
      input.classList.remove("invalid");
      error.textContent = "";
    });
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const message = projectNameError(input.value);
      if (message) {
        input.classList.add("invalid");
        error.textContent = message;
        input.focus();
        return;
      }
      input.disabled = true;
      submit.disabled = true;
      try {
        await options.submit(input.value.trim());
        hideFileAppMenu();
      } catch (operationError) {
        input.disabled = false;
        submit.disabled = false;
        input.classList.add("invalid");
        error.textContent = formatThrownError(operationError);
        input.focus();
      }
    });
    window.setTimeout(() => {
      input.focus();
      input.select();
    }, 0);
  }
  function showProjectListPanel(title, entries, select, markCurrent) {
    showFileAppMenuPanel(title);
    const list = document.createElement("div");
    list.className = "project-menu-list";
    const sorted = [...entries].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    if (sorted.length === 0) {
      const empty = document.createElement("p");
      empty.className = "project-menu-empty";
      empty.textContent = "Других проектов пока нет.";
      list.appendChild(empty);
    }
    for (const entry of sorted) {
      const button = document.createElement("button");
      button.type = "button";
      const name = document.createElement("strong");
      name.textContent = entry.name;
      button.appendChild(name);
      const details = document.createElement("small");
      details.textContent = markCurrent && entry.id === currentProjectId ? "Открыт сейчас" : `Изменён ${formatProjectDate(entry.updatedAt)}`;
      button.appendChild(details);
      button.disabled = Boolean(markCurrent && entry.id === currentProjectId);
      button.addEventListener("click", async () => {
        button.disabled = true;
        try {
          await select(entry.id);
        } catch (error) {
          button.disabled = false;
          reportProjectOperationError(error);
        }
      });
      list.appendChild(button);
    }
    fileAppMenuPanel.appendChild(list);
  }
  function showDeleteProjectPanel() {
    showFileAppMenuPanel("Удалить проект");
    const copy = document.createElement("p");
    copy.className = "project-delete-copy";
    copy.textContent = projectCatalog.length === 1 ? `Удалить «${currentProjectName}»? Вместо него будет создан новый пустой проект.` : `Удалить «${currentProjectName}»? Это действие нельзя отменить.`;
    fileAppMenuPanel.appendChild(copy);
    const actions = document.createElement("div");
    actions.className = "app-menu-form-actions";
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.textContent = "Нет";
    cancel.addEventListener("click", resetFileAppMenu);
    actions.appendChild(cancel);
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "app-menu-danger";
    remove.textContent = "Да, удалить";
    remove.addEventListener("click", async () => {
      remove.disabled = true;
      try {
        await deleteCurrentProject();
        hideFileAppMenu();
      } catch (error) {
        remove.disabled = false;
        reportProjectOperationError(error);
      }
    });
    actions.appendChild(remove);
    fileAppMenuPanel.appendChild(actions);
  }
  function showFileAppMenuPanel(title) {
    fileAppMenuMain.hidden = true;
    fileAppMenuPanel.hidden = false;
    fileAppMenuPanel.replaceChildren();
    const header = document.createElement("div");
    header.className = "app-menu-panel-header";
    const back = document.createElement("button");
    back.type = "button";
    back.textContent = "‹";
    back.title = "Назад";
    back.setAttribute("aria-label", "Назад");
    back.addEventListener("click", resetFileAppMenu);
    header.appendChild(back);
    const heading = document.createElement("strong");
    heading.textContent = title;
    header.appendChild(heading);
    fileAppMenuPanel.appendChild(header);
  }
  function formatProjectDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "недавно";
    return date.toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  }
  function reportProjectOperationError(error) {
    setStatus("Операция с проектом не выполнена", true);
    appendOutput(formatThrownError(error), "output-error");
  }
  function toggleEditAppMenu() {
    editAppMenu.hidden ? showEditAppMenu() : hideEditAppMenu();
  }
  function showEditAppMenu() {
    hideFileAppMenu();
    hideUploadMenu();
    hideThemeMenu();
    hideColorPickerMenu();
    hideFileContextMenu();
    updateEditMenuAvailability();
    editAppMenu.hidden = false;
    editAppMenuButton.setAttribute("aria-expanded", "true");
  }
  function hideEditAppMenu() {
    if (!editAppMenu) return;
    editAppMenu.hidden = true;
    editAppMenuButton.setAttribute("aria-expanded", "false");
  }
  function updateEditMenuAvailability() {
    const item = files.get(currentFile);
    const textFile = Boolean(item && item.kind === "text");
    const model = monacoReady && monacoEditor ? monacoEditor.getModel() : null;
    for (const button of editAppMenu.querySelectorAll("[data-edit-command]")) {
      const command = button.dataset.editCommand;
      if (!textFile) {
        button.disabled = true;
      } else if (command === "undo") {
        button.disabled = Boolean(model && !model.canUndo());
      } else if (command === "redo") {
        button.disabled = Boolean(model && !model.canRedo());
      } else {
        button.disabled = false;
      }
    }
  }
  function handleEditAppMenuClick(event) {
    if (!(event.target instanceof Element)) return;
    const button = event.target.closest("[data-edit-command]");
    if (!button || button.disabled) return;
    const command = button.dataset.editCommand;
    hideEditAppMenu();
    runEditorCommand(command);
  }
  function runEditorCommand(command) {
    if (monacoReady && monacoEditor) {
      const commands = {
        undo: "undo",
        redo: "redo",
        cut: "editor.action.clipboardCutAction",
        copy: "editor.action.clipboardCopyAction",
        paste: "editor.action.clipboardPasteAction",
        find: "actions.find",
        replace: "editor.action.startFindReplaceAction",
        comment: "editor.action.addCommentLine",
        uncomment: "editor.action.removeCommentLine"
      };
      const editorCommand = commands[command];
      if (!editorCommand) return;
      monacoEditor.focus();
      monacoEditor.trigger("menu", editorCommand, null);
      return;
    }
    editor.focus();
    if (command === "comment" || command === "uncomment") {
      editLegacyComment(command === "comment");
      return;
    }
    const legacyCommands = { undo: "undo", redo: "redo", cut: "cut", copy: "copy", paste: "paste" };
    if (legacyCommands[command]) document.execCommand(legacyCommands[command]);
  }
  function editLegacyComment(addComment) {
    const source = editor.value;
    const start = source.lastIndexOf("\n", Math.max(0, editor.selectionStart - 1)) + 1;
    const nextLine = source.indexOf("\n", editor.selectionEnd);
    const end = nextLine === -1 ? source.length : nextLine;
    const replacement = source.slice(start, end).split("\n").map((line) => {
      if (addComment) return line.replace(/^(\s*)/u, "$1// ");
      return line.replace(/^(\s*)\/\/ ?/u, "$1");
    }).join("\n");
    editor.setRangeText(replacement, start, end, "select");
    handleEditorInput();
  }
  function applySavedTheme() {
    const theme = window.localStorage.getItem("idyllium-web-theme") || "dark";
    setTheme(theme === "light" ? "light" : "dark");
  }
  function toggleThemeMenu() {
    themeMenu.hidden ? showThemeMenu() : hideThemeMenu();
  }
  function showThemeMenu() {
    hideFileAppMenu();
    hideEditAppMenu();
    hideUploadMenu();
    hideColorPickerMenu();
    themeMenu.hidden = false;
    themeButton.setAttribute("aria-expanded", "true");
  }
  function hideThemeMenu() {
    themeMenu.hidden = true;
    themeButton.setAttribute("aria-expanded", "false");
  }
  function installColorPicker() {
    for (const channel of COLOR_PICKER_CHANNELS) {
      colorSliders[channel].addEventListener("input", () => {
        setColorPickerComponent(channel, Number(colorSliders[channel].value));
      });
      colorInputs[channel].addEventListener("change", () => {
        setColorPickerComponent(channel, Number(colorInputs[channel].value));
      });
      colorInputs[channel].addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          setColorPickerComponent(channel, Number(colorInputs[channel].value));
          colorInputs[channel].blur();
          event.preventDefault();
        }
      });
    }
    for (const button of document.querySelectorAll(".color-step-button")) {
      button.addEventListener("click", () => {
        const channel = button.dataset.colorChannel;
        const step = Number(button.dataset.colorStep);
        if (!COLOR_PICKER_CHANNELS.includes(channel) || !Number.isFinite(step)) return;
        setColorPickerComponent(channel, colorPickerState[channel] + step);
      });
    }
    const copyRgbButton = document.getElementById("copy-rgb-button");
    const copyHexButton = document.getElementById("copy-hex-button");
    copyRgbButton.addEventListener("click", () => copyColorText(colorRgbCode.textContent, copyRgbButton));
    copyHexButton.addEventListener("click", () => copyColorText(colorHexCode.textContent, copyHexButton));
    setupColorEyedropper((picked) => {
      colorPickerState = { ...colorPickerState, red: picked.red, green: picked.green, blue: picked.blue };
      updateColorPickerUi();
    });
  }
  function toggleColorPickerMenu() {
    colorPickerMenu.hidden ? showColorPickerMenu() : hideColorPickerMenu();
  }
  function showColorPickerMenu() {
    hideFileAppMenu();
    hideEditAppMenu();
    hideUploadMenu();
    hideThemeMenu();
    colorPickerMenu.hidden = false;
    colorPickerButton.setAttribute("aria-expanded", "true");
  }
  function hideColorPickerMenu() {
    colorPickerMenu.hidden = true;
    colorPickerButton.setAttribute("aria-expanded", "false");
  }
  function setColorPickerComponent(channel, rawValue) {
    if (!Number.isFinite(rawValue)) {
      updateColorPickerUi();
      return;
    }
    colorPickerState = {
      ...colorPickerState,
      [channel]: normalizeColorPickerValue(channel, rawValue)
    };
    updateColorPickerUi();
  }
  function normalizeColorPickerValue(channel, value) {
    if (channel === "alpha") return Math.round(clamp(value, 0, 1) * 100) / 100;
    return Math.round(clamp(value, 0, 255));
  }
  function updateColorPickerUi() {
    const red = normalizeColorPickerValue("red", colorPickerState.red);
    const green = normalizeColorPickerValue("green", colorPickerState.green);
    const blue = normalizeColorPickerValue("blue", colorPickerState.blue);
    const alpha = normalizeColorPickerValue("alpha", colorPickerState.alpha);
    colorPickerState = { red, green, blue, alpha };
    colorSliders.red.value = String(red);
    colorSliders.green.value = String(green);
    colorSliders.blue.value = String(blue);
    colorSliders.alpha.value = formatAlpha(alpha);
    colorInputs.red.value = String(red);
    colorInputs.green.value = String(green);
    colorInputs.blue.value = String(blue);
    colorInputs.alpha.value = formatAlpha(alpha);
    const rgb = `rgb(${red}, ${green}, ${blue})`;
    const rgba = `rgba(${red}, ${green}, ${blue}, ${formatAlpha(alpha)})`;
    colorPreview.style.setProperty("--preview-rgb", rgb);
    colorPreview.style.setProperty("--preview-rgba", rgba);
    colorRgbCode.textContent = alpha >= 1 ? `colors.RGB(${red}, ${green}, ${blue})` : `colors.RGBA(${red}, ${green}, ${blue}, ${formatAlpha(alpha)})`;
    colorHexCode.textContent = `colors.HEX("${colorPickerHex(red, green, blue, alpha)}")`;
  }
  function colorPickerHex(red, green, blue, alpha) {
    const base = `#${componentToHex(red)}${componentToHex(green)}${componentToHex(blue)}`;
    return alpha >= 1 ? base : base + componentToHex(Math.round(alpha * 255));
  }
  function componentToHex(value) {
    return normalizeColorPickerValue("red", value).toString(16).padStart(2, "0");
  }
  function formatAlpha(value) {
    const rounded = normalizeColorPickerValue("alpha", value);
    return Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(/0+$/u, "").replace(/\.$/u, "");
  }
  async function copyColorText(text, button) {
    const value = String(text || "");
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(value);
      } else {
        copyTextFallback(value);
      }
      showColorCopyButtonState(button, "Скопировано", "copy-success");
    } catch (_error) {
      showColorCopyButtonState(button, "Ошибка", "copy-error");
    }
  }
  function copyTextFallback(text) {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.left = "-9999px";
    document.body.appendChild(area);
    area.select();
    const copied = document.execCommand("copy");
    area.remove();
    if (!copied) throw new Error("copy command failed");
  }
  function showColorCopyButtonState(button, text, className) {
    const previousTimer = colorCopyTimers.get(button);
    if (previousTimer !== void 0) window.clearTimeout(previousTimer);
    button.textContent = text;
    button.classList.remove("copy-success", "copy-error");
    button.classList.add(className);
    const timer = window.setTimeout(() => {
      button.textContent = "Копировать";
      button.classList.remove("copy-success", "copy-error");
      colorCopyTimers.delete(button);
    }, 1e3);
    colorCopyTimers.set(button, timer);
  }
  function setTheme(theme) {
    const dark = theme !== "light";
    document.body.classList.toggle("theme-dark", dark);
    document.body.classList.toggle("theme-light", !dark);
    themeDarkButton.classList.toggle("active", dark);
    themeLightButton.classList.toggle("active", !dark);
    window.localStorage.setItem("idyllium-web-theme", dark ? "dark" : "light");
    if (monacoReady && window.monaco) window.monaco.editor.setTheme(currentMonacoTheme());
    applyPreviewTheme();
  }
  function applyPreviewTheme() {
    guiFrame.style.backgroundColor = getComputedStyle(document.body).getPropertyValue("--preview-bg").trim();
    if (!guiFrame.contentWindow) return;
    guiFrame.contentWindow.postMessage({
      type: "theme",
      theme: document.body.classList.contains("theme-light") ? "light" : "dark"
    }, previewTargetOrigin);
  }
  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.addEventListener("load", () => resolve(String(reader.result || "")));
      reader.addEventListener("error", () => reject(reader.error || new Error("file read failed")));
      reader.readAsDataURL(file);
    });
  }
  function readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.addEventListener("load", () => resolve(String(reader.result || "")));
      reader.addEventListener("error", () => reject(reader.error || new Error("file read failed")));
      reader.readAsText(file, "utf-8");
    });
  }
  function isEditableTextFile(file) {
    return isEditableTextName(file.name, file.type);
  }
  function isEditableTextName(fileName, mimeType = "") {
    if (mimeType.startsWith("text/")) return true;
    const name = fileName.toLowerCase();
    return name.endsWith(".idyl") || name.endsWith(".txt") || name.endsWith(".csv") || name.endsWith(".json") || name.endsWith(".md") || name.endsWith(".markdown") || name.endsWith(".xml") || name.endsWith(".svg") || name.endsWith(".html") || name.endsWith(".htm") || name.endsWith(".css");
  }
})();
