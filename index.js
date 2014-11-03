var path = require("path");

var rootEndPoints = [
    "bundles/org.eclipse.orion.client.core/web",
    "bundles/org.eclipse.orion.client.ui/web",
    "bundles/org.eclipse.orion.client.editor/web",
    "bundles/org.eclipse.orion.client.git/web",
    "bundles/org.eclipse.orion.client.javascript/web",
    "bundles/org.eclipse.orion.client.releng/web",
    "bundles/org.eclipse.orion.client.repository/web",
    "bundles/org.eclipse.orion.client.users/web",
    "bundles/org.eclipse.orion.client.webtools/web",
    "bundles/org.eclipse.orion.client.cf/web"
];

var routes = [];

routes.push(
    {
        remote: "/eslint/lib/conf",
        local: path.resolve(__dirname, "bundles/org.eclipse.orion.client.javascript/web/eslint/conf")
    },
    {
        remote: "/eslint/conf",
        local: path.resolve(__dirname, "bundles/org.eclipse.orion.client.javascript/web/eslint/conf")
    },
    {
        remote: "/eslint",
        local: path.resolve(__dirname, "bundles/org.eclipse.orion.client.javascript/web/eslint/lib")
    }
);


rootEndPoints.forEach(function (dir) {
    routes.push({
        remote: "/",
        local: path.resolve(__dirname, dir)
    });
});


exports.routes = routes;