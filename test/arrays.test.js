// Copyright 2013 Joyent.  All rights reserved.

var once = require('once');
var libuuid = require('libuuid');
var vasync = require('vasync');

if (require.cache[__dirname + '/helper.js'])
    delete require.cache[__dirname + '/helper.js'];
var helper = require('./helper.js');



///--- Globals

var after = helper.after;
var before = helper.before;
var test = helper.test;
var uuid = {
    v1: libuuid.create,
    v4: libuuid.create
};



///--- Tests

before(function (cb) {
    this.bucket = 'moray_unit_test_' + uuid.v4().substr(0, 7);

    this.client = helper.createClient();
    this.client.on('connect', cb);

});

after(function (cb) {
    var self = this;
    // May or may not exist, just blindly ignore
    this.client.delBucket(this.bucket, function () {
        self.client.close();
        cb();
    });
});


test('schema array, array value (string)', function (t) {
    var b = this.bucket;
    var c = this.client;
    var k = uuid.v4();
    var cfg = {
        index: {
            name: {
                type: '[string]',
                unique: false
            }
        }
    };
    var data = {
        name: ['foo', 'bar', 'baz'],
        ignoreme: 'foo'
    };

    vasync.pipeline({
        funcs: [
            function bucket(_, cb) {
                c.putBucket(b, cfg, cb);
            },
            function object(_, cb) {
                c.putObject(b, k, data, cb);
            },
            function find(_, cb) {
                cb = once(cb);

                var found = false;
                var req = c.findObjects(b, '(name=foo)');
                req.once('error', cb);
                req.once('record', function (obj) {
                    t.ok(obj);
                    if (obj) {
                        t.equal(obj.bucket, b);
                        t.equal(obj.key, k);
                        t.deepEqual(obj.value, data);
                        t.ok(obj._id);
                        t.ok(obj._etag);
                        t.ok(obj._mtime);
                        found = true;
                    }
                });
                req.once('end', function () {
                    t.ok(found);
                    cb();
                });
            }
        ],
        arg: null
    }, function (err) {
        t.ifError(err);
        t.end();
    });
});


test('schema array, scalar value (string)', function (t) {
    var b = this.bucket;
    var c = this.client;
    var k = uuid.v4();
    var cfg = {
        index: {
            name: {
                type: '[string]',
                unique: false
            }
        }
    };
    var data = {
        name: 'foo',
        ignoreme: 'foo'
    };

    vasync.pipeline({
        funcs: [
            function bucket(_, cb) {
                c.putBucket(b, cfg, cb);
            },
            function object(_, cb) {
                c.putObject(b, k, data, cb);
            },
            function find(_, cb) {
                cb = once(cb);

                var found = false;
                var req = c.findObjects(b, '(name=foo)');
                req.once('error', cb);
                req.once('record', function (obj) {
                    t.ok(obj);
                    if (obj) {
                        t.equal(obj.bucket, b);
                        t.equal(obj.key, k);
                        // Moray converts back into an
                        // array...
                        data.name = [data.name];
                        t.deepEqual(obj.value, data);
                        t.ok(obj._id);
                        t.ok(obj._etag);
                        t.ok(obj._mtime);
                        found = true;
                    }
                });
                req.once('end', function () {
                    t.ok(found);
                    cb();
                });
            }
        ],
        arg: null
    }, function (err) {
        t.ifError(err);
        t.end();
    });
});


test('schema array, array value (number)', function (t) {
    var b = this.bucket;
    var c = this.client;
    var k = uuid.v4();
    var cfg = {
        index: {
            id: {
                type: '[number]',
                unique: false
            }
        }
    };
    var data = {
        id: [1, 2, 3],
        ignoreme: 'foo'
    };
    var found = 0;

    function checkObject(obj) {
        t.ok(obj);
        if (obj) {
            t.equal(obj.bucket, b);
            t.equal(obj.key, k);
            t.deepEqual(obj.value, data);
            t.ok(obj._id);
            t.ok(obj._etag);
            t.ok(obj._mtime);
            found++;
        }
    }

    vasync.pipeline({
        funcs: [
            function setup(_, cb) {
                c.putBucket(b, cfg, function (err) {
                    if (err) {
                        cb(err);
                    } else {
                        c.putObject(b, k, data, cb);
                    }
                });
            },
            function eq(_, cb) {
                cb = once(cb);

                var req = c.findObjects(b, '(id=1)');
                req.once('error', cb);
                req.once('record', checkObject);
                req.once('end', cb);
            },
            function gte(_, cb) {
                cb = once(cb);

                var req = c.findObjects(b, '(id>=3)');
                req.once('error', cb);
                req.once('record', checkObject);
                req.once('end', cb);
            },
            function lte(_, cb) {
                cb = once(cb);

                var req = c.findObjects(b, '(id<=1)');
                req.once('error', cb);
                req.once('record', checkObject);
                req.once('end', cb);
            },
            function presence(_, cb) {
                cb = once(cb);

                var req = c.findObjects(b, '(id=*)');
                req.once('error', cb);
                req.once('record', checkObject);
                req.once('end', cb);
            },
            function and(_, cb) {
                cb = once(cb);

                var req = c.findObjects(b, '(&(id<=3)(id>=1))');
                req.once('error', cb);
                req.once('record', checkObject);
                req.once('end', cb);
            },
            function or(_, cb) {
                cb = once(cb);

                var req = c.findObjects(b, '(|(id<=0)(id>=1))');
                req.once('error', cb);
                req.once('record', checkObject);
                req.once('end', cb);
            },
            function not(_, cb) {
                cb = once(cb);

                var req = c.findObjects(b, '(!(id=0))');
                req.once('error', cb);
                req.once('record', checkObject);
                req.once('end', cb);
            }
        ],
        arg: null
    }, function (err, results) {
        t.ifError(err);
        t.equal(found, results.operations.length - 1);
        t.end();
    });
});


test('schema array string, substring filter throws', function (t) {
    var b = this.bucket;
    var c = this.client;
    var k = uuid.v4();
    var cfg = {
        index: {
            name: {
                type: '[string]',
                unique: false
            }
        }
    };
    var data = {
        name: ['foo', 'bar', 'baz'],
        ignoreme: 'foo'
    };

    vasync.pipeline({
        funcs: [
            function setup(_, cb) {
                c.putBucket(b, cfg, function (err) {
                    if (err) {
                        cb(err);
                    } else {
                        c.putObject(b, k, data, cb);
                    }
                });
            },
            function substr(_, cb) {
                cb = once(cb);

                var req = c.findObjects(b, '(name=f*)');
                req.once('error', function (err) {
                    t.ok(err);
                    cb(err);
                });
                req.once('end', cb);
            }
        ],
        arg: null
    }, function (err, results) {
        t.ok(err);
        t.end();
    });
});


test('schema array, array value (number), updates', function (t) {
    var b = this.bucket;
    var c = this.client;
    var k = libuuid.create();
    var cfg = {
        index: {
            id: {
                type: '[number]',
                unique: false
            }
        }
    };
    var data = {
        id: [5, 6, 7],
        ignoreme: 'foo'
    };
    var found = 0;

    var objects = [];

    objects.push({
        bucket: b,
        key: k,
        value: data
    });

    objects.push({
        bucket: b,
        key: k,
        value: {
            id: [1, 2, 3]
        }
    });

    function checkObject(obj) {
        t.ok(obj);
        if (obj) {
            t.equal(obj.bucket, b);
            t.equal(obj.key, k);
            t.deepEqual(obj.value, {
                id: [1, 2, 3]
            });
            t.ok(obj._id);
            t.ok(obj._etag);
            t.ok(obj._mtime);
            found++;
        }
    }

    vasync.pipeline({
        funcs: [
            function setup(_, cb) {
                c.putBucket(b, cfg, function (err) {
                    if (err) {
                        cb(err);
                    } else {
                        c.batch(objects, cb);
                    }
                });
            },
            function eq(_, cb) {
                cb = once(cb);

                var req = c.findObjects(b, '(id=1)');
                req.once('error', cb);
                req.once('record', checkObject);
                req.once('end', cb);
            }
        ],
        arg: null
    }, function (err, results) {
        t.ifError(err);
        t.equal(found, results.operations.length - 1);
        t.end();
    });
});


test('schema array, array value (string), updates', function (t) {
    var b = this.bucket;
    var c = this.client;
    var k = libuuid.create();
    var cfg = {
        index: {
            name: {
                type: '[string]',
                unique: false
            }
        }
    };
    var data = {
        name: ['bar', 'foo', 'baz'],
        ignoreme: 'foo'
    };

    var objects = [];

    objects.push({
        bucket: b,
        key: k,
        value: data
    });

    objects.push({
        bucket: b,
        key: k,
        value: {
            name: ['foo', 'bar', 'baz']
        }
    });

    vasync.pipeline({
        funcs: [
            function setup(_, cb) {
                c.putBucket(b, cfg, function (err) {
                    if (err) {
                        cb(err);
                    } else {
                        c.batch(objects, cb);
                    }
                });
            },
            function find(_, cb) {
                cb = once(cb);

                var found = false;
                var req = c.findObjects(b, '(name=foo)');
                req.once('error', cb);
                req.once('record', function (obj) {
                    t.ok(obj);
                    if (obj) {
                        t.equal(obj.bucket, b);
                        t.equal(obj.key, k);
                        t.deepEqual(obj.value, {
                            name: ['foo', 'bar', 'baz']
                        });
                        t.ok(obj._id);
                        t.ok(obj._etag);
                        t.ok(obj._mtime);
                        found = true;
                    }
                });
                req.once('end', function () {
                    t.ok(found);
                    cb();
                });
            }
        ],
        arg: null
    }, function (err, results) {
        t.ifError(err);
        t.end();
    });
});



test('schema array, array value (boolean), updates', function (t) {
    var b = this.bucket;
    var c = this.client;
    var k = libuuid.create();
    var cfg = {
        index: {
            id: {
                type: '[boolean]',
                unique: false
            }
        }
    };
    var data = {
        id: [true, false, true],
        ignoreme: 'foo'
    };
    var found = 0;

    var objects = [];

    objects.push({
        bucket: b,
        key: k,
        value: data
    });

    objects.push({
        bucket: b,
        key: k,
        value: {
            id: [false, false, false]
        }
    });

    function checkObject(obj) {
        t.ok(obj);
        if (obj) {
            t.equal(obj.bucket, b);
            t.equal(obj.key, k);
            t.deepEqual(obj.value, {
                id: [false, false, false]
            });
            t.ok(obj._id);
            t.ok(obj._etag);
            t.ok(obj._mtime);
            found++;
        }
    }

    vasync.pipeline({
        funcs: [
            function setup(_, cb) {
                c.putBucket(b, cfg, function (err) {
                    if (err) {
                        cb(err);
                    } else {
                        c.batch(objects, cb);
                    }
                });
            },
            function eq(_, cb) {
                cb = once(cb);

                var req = c.findObjects(b, '(id=false)');
                req.once('error', cb);
                req.once('record', checkObject);
                req.once('end', cb);
            }
        ],
        arg: null
    }, function (err, results) {
        t.ifError(err);
        t.equal(found, results.operations.length - 1);
        t.end();
    });
});


test('schema array, value (string) includes commas/curly braces', function (t) {
    var b = this.bucket;
    var c = this.client;
    var k = libuuid.create();
    var cfg = {
        index: {
            name: {
                type: '[string]',
                unique: false
            }
        }
    };
    var data = {
        name: ['{"foo": {"bar": "baz"}}'],
        ignoreme: 'foo'
    };

    var objects = [];

    objects.push({
        bucket: b,
        key: k,
        value: data
    });

    objects.push({
        bucket: b,
        key: k,
        value: {
            name: ['{"foo": {"baz": "bar", "with": "commas"}}']
        }
    });

    vasync.pipeline({
        funcs: [
            function setup(_, cb) {
                c.putBucket(b, cfg, function (err) {
                    if (err) {
                        cb(err);
                    } else {
                        c.batch(objects, cb);
                    }
                });
            }
        ],
        arg: null
    }, function (err, results) {
        t.ifError(err);
        t.end();
    });
});
