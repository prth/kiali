import { Before, Given, Then, When } from 'cypress-cucumber-preprocessor/steps';

const url = '/console';

Before(() => {
  // Copied from overview.ts.  This prevents cypress from stopping on errors unrelated to the tests.
  // There can be random failures due timeouts/loadtime/framework that throw browser errors.  This
  // prevents a CI failure due something like a "slow".  There may be a better way to handle this.
  cy.on('uncaught:exception', (err, runnable, promise) => {
    // when the exception originated from an unhandled promise
    // rejection, the promise is provided as a third argument
    // you can turn off failing the test in this case
    if (promise) {
      return false;
    }
    // we still want to ensure there are no other unexpected
    // errors, so we let them fail the test
  });
});

When('user graphs {string} namespaces', namespaces => {
  // Forcing "Pause" to not cause unhandled promises from the browser when cypress is testing
  cy.visit(url + `/graph/namespaces?refresh=0&namespaces=${namespaces}`);
});

When('user opens display menu', () => {
  cy.get('button#display-settings').click();
});

When('user enables {string} {string} edge labels', (radio, edgeLabel) => {
  cy.get('div#graph-display-menu').find(`input#${edgeLabel}`).check();
  cy.get(`input#${radio}`).check();
});

When('user {string} {string} edge labels', (action, edgeLabel) => {
  if (action === 'enables') {
    cy.get('div#graph-display-menu').find(`input#${edgeLabel}`).check();
  } else {
    cy.get('div#graph-display-menu').find(`input#${edgeLabel}`).uncheck();
  }
});

When('user {string} {string} option', (action, option: string) => {
  let id: string;
  switch (option.toLowerCase()) {
    case 'cluster boxes':
      option = 'boxByCluster';
      break;
    case 'idle edges':
      option = 'filterIdleEdges';
      break;
    case 'idle nodes':
      option = 'filterIdleNodes';
      break;
    case 'missing sidecars':
      option = 'filterSidecars';
      break;
    case 'namespace boxes':
      option = 'boxByNamespace';
      break;
    case 'rank':
      option = 'rank';
      break;
    case 'service nodes':
      option = 'filterServiceNodes';
      break;
    case 'security':
      option = 'filterSecurity';
      break;
    case 'traffic animation':
      option = 'filterTrafficAnimation';
      break;
    case 'virtual services':
      option = 'filterVS';
      break;
    default:
      option = 'xxx';
  }

  if (action === 'enables') {
    cy.get('div#graph-display-menu').find(`input#${option}`).check();
    if (option === 'rank') {
      cy.get(`input#inboundEdges`).check();
    }
  } else {
    cy.get('div#graph-display-menu').find(`input#${option}`).uncheck();
  }
});

When('user resets to factory default', () => {
  cy.get('button#graph-factory-reset').click()
  cy.get('#loading_kiali_spinner').should('not.exist');
});

///////////////////

Then(`user sees no namespace selected`, () => {
  cy.get('div#empty-graph-no-namespace').should('be.visible');
});

Then(`user sees the {string} namespace`, ns => {
  cy.get('div#summary-panel-graph').find('div#summary-panel-graph-heading').find(`span#ns-${ns}`).should('be.visible');
});

Then('the display menu opens', () => {
  cy.get('button#display-settings').invoke('attr', 'aria-expanded').should('eq', 'true');
  cy.get('div#graph-display-menu').should('exist');
});

Then('the display menu has default settings', () => {
  cy.get('div#graph-display-menu').within(() => {
    cy.get(`input#responseTime`).should('exist').should('not.be.checked');
    cy.get(`input#throughput`).should('exist').should('not.be.checked');
    cy.get(`input#trafficDistribution`).should('exist').should('not.be.checked');
    cy.get(`input#trafficRate`).should('exist').should('not.be.checked');
    cy.get(`input#boxByCluster`).should('exist').should('be.checked');
    cy.get(`input#boxByNamespace`).should('exist').should('be.checked');
    cy.get(`input#filterHide`).should('exist').should('be.checked');
    cy.get(`input#filterIdleEdges`).should('exist').should('not.be.checked');
    cy.get(`input#filterIdleNodes`).should('exist').should('not.be.checked');
    cy.get(`input#filterOperationNodes`).should('exist').should('not.be.checked');
    cy.get(`input#rank`).should('exist').should('not.be.checked');
    cy.get(`input#filterServiceNodes`).should('exist').should('be.checked');
    cy.get(`input#filterTrafficAnimation`).should('exist').should('not.be.checked');
    cy.get(`input#filterSidecars`).should('exist').should('be.checked');
    cy.get(`input#filterSecurity`).should('exist').should('not.be.checked');
    cy.get(`input#filterVS`).should('exist').should('be.checked');
  });
});

Then('the graph reflects default settings', () => {
  cy.waitForReact();
  cy.getReact('CytoscapeGraph')
    .should('have.length', '1')
    .getCurrentState()
    .then(state => {
      // no nonDefault edge label info
      let numEdges = state.cy.edges(`[?responseTime],[?throughput]`).length;
      assert.equal(numEdges, 0);

      // no idle edges, mtls
      numEdges = state.cy.edges(`[^hasTraffic],[isMTLS > 0]`).length;
      assert.equal(numEdges, 0);

      // boxes
      let numNodes = state.cy.nodes(`[isBox = "app"]`).length;
      assert.isAbove(numNodes, 0);
      numNodes = state.cy.nodes(`[isBox = "namespace"]`).length;
      assert.isAbove(numNodes, 0);

      // service nodes
      numNodes = state.cy.nodes(`[nodeType = "service"]`).length;
      assert.isAbove(numNodes, 0);

      // a variety of not-found tests
      numNodes = state.cy.nodes(`[isBox = "cluster"],[?isIdle],[?rank],[nodeType = "operation"]`).length;
      assert.equal(numNodes, 0);
    });
});

Then('user sees {string} edge labels', el => {
  validateInput(el, 'appear');

  let rate;
  switch (el) {
    case 'trafficDistribution':
      rate = 'httpPercentReq';
      break;
    case 'trafficRate':
      rate = 'http';
      break;
    default:
      rate = el;
  }

  cy.waitForReact();
  cy.getReact('CytoscapeGraph')
    .should('have.length', '1')
    .getCurrentState()
    .then(state => {
      const numEdges = state.cy.edges(`[${rate}" > 0]`).length;
      assert.isAbove(numEdges, 0);
    });
});

Then('user sees {string} edge label option is closed', edgeLabel => {
  validateInput(edgeLabel, 'does not appear');
});

Then('user does not see {string} boxing', (boxByType: string) => {
  validateInput(`boxBy${boxByType}`, 'does not appear');

  cy.waitForReact();
  cy.getReact('CytoscapeGraph')
    .should('have.length', '1')
    .getCurrentState()
    .then(state => {
      const numBoxes = state.cy.nodes(`[isBox = "${boxByType.toLowerCase()}"]`).length;
      assert.equal(numBoxes, 0);
    });
});

Then('idle edges {string} in the graph', action => {
  validateInput('filterIdleEdges', action);

  cy.waitForReact();
  cy.getReact('CytoscapeGraph')
    .should('have.length', '1')
    .getCurrentState()
    .then(state => {
      const numEdges = state.cy.edges(`[^hasTraffic]`).length;
      if (action === 'appear') {
        assert.isAbove(numEdges, 0);
      } else {
        assert.equal(numEdges, 0);
      }
    });
});

Then('idle nodes {string} in the graph', action => {
  validateInput('filterIdleNodes', action);

  cy.waitForReact();
  cy.getReact('CytoscapeGraph')
    .should('have.length', '1')
    .getCurrentState()
    .then(state => {
      const numNodes = state.cy.nodes(`[?isIdle]`).length;
      if (action === 'appear') {
        assert.isAbove(numNodes, 0);
      } else {
        assert.equal(numNodes, 0);
      }
    });
});

Then('ranks {string} in the graph', action => {
  validateInput('rank', action);

  cy.waitForReact();
  cy.getReact('CytoscapeGraph')
    .should('have.length', '1')
    .getCurrentState()
    .then(state => {
      const numNodes = state.cy.nodes(`[rank > 0]`).length;
      if (action === 'appear') {
        assert.isAbove(numNodes, 0);
      } else {
        assert.equal(numNodes, 0);
      }
    });
});

Then('user does not see service nodes', () => {
  validateInput('filterServiceNodes', 'do not appear');

  cy.waitForReact();
  cy.getReact('CytoscapeGraph')
    .should('have.length', '1')
    .getCurrentState()
    .then(state => {
      const numBoxes = state.cy.nodes(`[nodeType = "service"][^isOutside]`).length;
      assert.equal(numBoxes, 0);
    });
});

Then('security {string} in the graph', action => {
  validateInput('filterSecurity', action);

  cy.waitForReact();
  cy.getReact('CytoscapeGraph')
    .should('have.length', '1')
    .getCurrentState()
    .then(state => {
      const numEdges = state.cy.edges(`[isMTLS > 0]`).length;
      if (action === 'appears') {
        assert.isAbove(numEdges, 0);
      } else {
        assert.equal(numEdges, 0);
      }
    });
});

Then('{string} option {string} in the graph', (option, action) => {
  let id: string;
  switch (option.toLowerCase()) {
    case 'missing sidecars':
      option = 'filterSidecars';
      break;
    case 'traffic animation':
      option = 'filterTrafficAnimation';
      break;
    case 'virtual services':
      option = 'filterVS';
      break;
    default:
      option = 'xxx';
  }

  validateInput(option, action);
});

function validateInput(option: string, action: string) {
  if (action.startsWith('appear')) {
    cy.get('div#graph-display-menu')
      .find(`input#${option}`)
      .should('exist')
      .should('be.checked')
      .should('not.be.disabled'); // this forces a wait, enables when graph is refreshed
  } else {
    cy.get('div#graph-display-menu')
      .find(`input#${option}`)
      .should('exist')
      .should('not.be.checked')
      .should('not.be.disabled'); // this forces a wait, enables when graph is refreshed
  }
}
