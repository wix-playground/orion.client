define([], function () {

    var TYPE_EDITOR_VIEW_CLASS = "editor_view";

    function ExtensionRegistry() {
        this._dict = {};
    }

    ExtensionRegistry.prototype = {
        _setValue: function (type, key, value) {
            this._dict[type] = this._dict[type] || {};
            this._dict[type][key] = value;
        },

        _getValue: function (type, key) {
            if(this._dict[type]) {
                return this._dict[type][key];
            }
        },

        addEditorViewClass: function (id, cls) {
            this._setValue(TYPE_EDITOR_VIEW_CLASS, id, cls);
        },

        getEditorViewClass: function (id) {
            return this._getValue(TYPE_EDITOR_VIEW_CLASS, id);
        }
    };

    return {
        ExtensionRegistry: ExtensionRegistry
    }

});