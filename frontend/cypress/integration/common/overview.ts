import { Before, Given, Then, When } from "cypress-cucumber-preprocessor/steps";

const url = "/console";

Before(() => {
    // Focing to not stop cypress on unexpected errors not related to the tests.
    // There are some random failures due timeouts/loadtime/framework that throws some error in the browser.
    // After reviewing the tests failures, those are unrelated to the app, so,
    // it needs this event to not fail the CI action due some "slow" action or similar.
    // This is something to review in future iterations when tests are solid, but I haven't found a better way to
    // solve this issue.
    cy.on("uncaught:exception", (err, runnable, promise) => {
        // when the exception originated from an unhandled promise
        // rejection, the promise is provided as a third argument
        // you can turn off failing the test in this case
        if (promise) {
            return false
        }
        // we still want to ensure there are no other unexpected
        // errors, so we let them fail the test
    });
});

Given('user opens the overview page', () => {
    // Forcing "Pause" to not cause unhandled promises from the browser when cypress is testing
    cy.visit(url + '/overview?refresh=0');
});

Given('a healthy application in the cluster', function () {
    this.targetNamespace = 'bookinfo';
    this.targetApp = 'productpage';
});

Given('an idle application in the cluster', function () {
    this.targetNamespace = 'default';
    this.targetApp = 'sleep';

    cy.exec('kubectl scale -n default --replicas=0 deployment/sleep');
});

Given('a failing application in the mesh', function () {
    this.targetNamespace = 'alpha';
    this.targetApp = 'v-server';
});

Given('a degraded application in the mesh', function () {
    this.targetNamespace = 'alpha';
    this.targetApp = 'b-client';
});

When('user clicks in the {string} view', (view) => {
    cy.get('button[data-test="overview-type-' + view + '"]')
        .click()
        // Using the #loading_kiali_spinner selector we can control when the UI is still loading some data
        // That may prevent that the test progress in cases where we need more control.
        .get('#loading_kiali_spinner')
        .should('not.exist');
});

When(`user filters {string} namespace`, (ns) => {
    cy.get('select[aria-label="filter_select_type"]')
        .select('Namespace')
        .should('have.value', 'Namespace');
    cy.get('input[aria-label="filter_input_value"]')
        .type(ns)
        .type('{enter}')
        .get('#loading_kiali_spinner')
        .should('not.exist');
});

When(`user filters {string} health`, (health) => {
    cy.get('select[aria-label="filter_select_type"]')
        .select('Health')
        .should('have.value', 'Health');
    cy.get('select[aria-label="filter_select_value"]')
        .select(health)
        .get('#loading_kiali_spinner')
        .should('not.exist');
});

When(`user selects Health for {string}`, (type) => {
    let innerId = '';
    switch (type) {
        case 'Apps':
            innerId = 'app';
            break;
        case 'Workloads':
            innerId = 'workload';
            break;
        case 'Services':
            innerId = 'service';
            break;
    }
    cy.get('button[aria-labelledby^="overview-type"]')
        .click()
        .get('#loading_kiali_spinner')
        .should('not.exist');
    cy.get(`li[id="${innerId}"]`).children('button')
        .click()
        .get('#loading_kiali_spinner')
        .should('not.exist');
});

When(`user sorts by name desc`, () => {
    cy.get('button[data-sort-asc="true"]')
        .click()
        .get('#loading_kiali_spinner')
        .should('not.exist');
});

When(`user selects {string} time range`, (interval) => {
    let innerId = '';
    switch (interval) {
        case 'Last 10m':
            innerId = '600';
            break;
    }
    cy.get('button[aria-labelledby^="time_range_duration"]')
        .click()
        .get('#loading_kiali_spinner')
        .should('not.exist');
    cy.get(`li[id="${innerId}"]`).children('button')
        .click()
        .get('#loading_kiali_spinner')
        .should('not.exist');
});

When('I fetch the overview of the cluster', function () {
    cy.visit('/console/overview?refresh=0');
});

Then(`user sees the {string} namespace card`, (ns) => {
    cy.get('article[data-test^="' + ns + '"]');
});

Then(`user doesn't see the {string} namespace card`, (ns) => {
    cy.get('article[data-test^="' + ns + '"]').should('not.exist');
});

Then(`user sees a {string} {string} namespace`, (view, ns) => {
    if (view === "LIST") {
        cy.get('td[role="gridcell"]').contains(ns);
    } else {
        cy.get('article[data-test="' + ns + '-' + view +'"]');
    }
});

Then(`user sees the {string} namespace with {string}`, (ns, type) => {
    let innerType = '';
    switch (type) {
        case 'Applications':
            innerType = 'app';
            break;
        case 'Workloads':
            innerType = 'workload';
            break;
        case 'Services':
            innerType = 'service';
            break;
    }
    cy.get('article[data-test^="' + ns + '"]').find('[data-test="overview-type-' + innerType + '"]');
});

Then(`user sees the {string} namespace list`, (nslist) => {
    const nss = nslist.split(',');
    cy.get('article')
        .should('have.length', nss.length)
        .each(($a, i) => {
            expect($a.attr("data-test")).includes(nss[i]);
        });
});

Then(`user sees the {string} namespace with Inbound traffic {string}`, (ns, duration) => {
    cy.get('article[data-test^="' + ns + '"]').find('span[data-test="sparkline-duration-' + duration + '"]');
});

Then('there should be a {string} application indicator in the namespace', function (healthStatus: string) {
    cy.get(`[data-test=${this.targetNamespace}-EXPAND] [data-test=overview-app-health] svg[class=icon-${healthStatus}]`)
        .should('exist');
});

Then('the {string} application indicator should list the application', function (healthStatus: string) {
    let healthIndicatorStatusKey = healthStatus;
    if (healthStatus === 'idle') {
        healthIndicatorStatusKey = 'not-ready';
    }

    cy.get(`[data-test=${this.targetNamespace}-EXPAND] [data-test=overview-app-health] svg[class=icon-${healthStatus}]`)
        .trigger('mouseenter');
    cy.get(`[aria-label='Overview status'][class*=health_indicator] [data-test=${this.targetNamespace}-${healthIndicatorStatusKey}-${this.targetApp}] svg[class=icon-${healthStatus}]`)
        .should('exist');
    cy.get(`[aria-label='Overview status'][class*=health_indicator] [data-test=${this.targetNamespace}-${healthIndicatorStatusKey}-${this.targetApp}]`)
        .should('contain.text', this.targetApp);
});
