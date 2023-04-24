"use strict";
class Loadable {
    constructor(filename) {
        this.filename = filename;
    }

    load() {
        return fetch(`/${this.filename}`)
            .then(res => res.json())
            .then(data => {
                return Loadable.#loadObj(data);
            });
    }

    static #loadObj(data) {
        return new Proxy(data, {
            get: (target, name) => {
                if (Reflect.has(target, name)) {
                    const value = Reflect.get(target, name);
                    if (Array.isArray(value)) {
                        return value.map(item => Loadable.maybeLoadable(item));
                    }
                    return Loadable.maybeLoadable(value);
                }
                return Reflect.get(target, name);
            }
        });
    }

    static maybeLoadable(obj) {
        if (typeof obj === 'object' && Object.hasOwn(obj, 'load')) {
            // Loadable field, will automatically load when it's properties are first accessed
            const loadable = new Loadable(obj.load);
            let loaded = false;
            let loadedData = null;
            return new Proxy({}, {
                get: (target, name) => {
                    // No field exists by definition, will have to load on first invocation
                    // with memorization
                    if (!loaded) {
                        loadedData = loadable.load();
                        loaded = true;
                    }
                    return loadedData.then(data => data[name]);
                }
            });
        }
        // If native type, just return itself
        if (typeof obj !== 'object') {
            return Promise.resolve(obj);
        }
        // If object, return reflection of itself
        return Loadable.#loadObj(obj);
    }
}

(async () => {
    const pl = await (new Loadable('pl.json')).load();
    const version = await pl.version; // normal fields can be returned
    const data = await pl.data; // arrays can be returned
    const firstRecord = data[0]; // treated as loadable
    const firstRecordVersion = await firstRecord.version; // normal fields can be returned
    console.assert(firstRecordVersion == 1, 'version should be 1');
    const firstRecordVersionAgain = await firstRecord.version; // with memorization, file won't load again
    console.assert(firstRecordVersionAgain == 1, 'version should be 1 when access again');
    const firstRecordExtra = await firstRecord.extra; // nested loadable
    const firstRecordExtraContent = await firstRecordExtra.data;
    console.assert(firstRecordExtraContent == 'data1_extra content', 'extra content should be data1_extra content');
    console.log('all tests passed');
})();