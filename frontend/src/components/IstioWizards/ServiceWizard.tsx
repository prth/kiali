import * as React from 'react';
import { Button, ExpandableSection, Modal, ModalVariant, Tab, Tabs } from '@patternfly/react-core';
import { WorkloadOverview } from '../../types/ServiceInfo';
import * as API from '../../services/Api';
import { Response } from '../../services/Api';
import * as AlertUtils from '../../utils/AlertUtils';
import RequestRouting from './RequestRouting';
import TrafficShifting, { WorkloadWeight } from './TrafficShifting';
import TrafficPolicyContainer, {
  ConsistentHashType,
  TrafficPolicyState,
  UNSET
} from '../../components/IstioWizards/TrafficPolicy';
import { ROUND_ROBIN } from './TrafficPolicy';
import FaultInjection, { FaultInjectionRoute } from './FaultInjection';
import { Rule } from './RequestRouting/Rules';
import {
  buildIstioConfig,
  fqdnServiceName,
  getInitGateway,
  getInitHosts,
  getInitLoadBalancer,
  getInitPeerAuthentication,
  getInitRules,
  getInitTlsMode,
  getInitWeights,
  hasGateway,
  WIZARD_REQUEST_ROUTING,
  WIZARD_FAULT_INJECTION,
  WIZARD_TITLES,
  WIZARD_TRAFFIC_SHIFTING,
  ServiceWizardProps,
  ServiceWizardState,
  getInitFaultInjectionRoute,
  WIZARD_REQUEST_TIMEOUTS,
  getInitTimeoutRetryRoute,
  getInitConnectionPool,
  getInitOutlierDetection,
  WIZARD_TCP_TRAFFIC_SHIFTING,
  WizardPreviews
} from './WizardActions';
import { MessageType } from '../../types/MessageCenter';
import GatewaySelector, { GatewaySelectorState } from './GatewaySelector';
import VirtualServiceHosts from './VirtualServiceHosts';
import {
  DestinationRule,
  Gateway,
  PeerAuthentication,
  PeerAuthenticationMutualTLSMode,
  VirtualService
} from '../../types/IstioObjects';
import { style } from 'typestyle';
import RequestTimeouts, { TimeoutRetryRoute } from './RequestTimeouts';
import CircuitBreaker, { CircuitBreakerState } from './CircuitBreaker';
import _ from 'lodash';
import { ConfigPreviewItem, IstioConfigPreview } from 'components/IstioConfigPreview/IstioConfigPreview';

const emptyServiceWizardState = (fqdnServiceName: string): ServiceWizardState => {
  return {
    showWizard: false,
    showAdvanced: false,
    showPreview: false,
    confirmationModal: false,
    previews: undefined,
    advancedTabKey: 0,
    workloads: [],
    rules: [],
    faultInjectionRoute: {
      workloads: [],
      delayed: false,
      delay: {
        percentage: {
          value: 100
        },
        fixedDelay: '5s'
      },
      isValidDelay: true,
      aborted: false,
      abort: {
        percentage: {
          value: 100
        },
        httpStatus: 503
      },
      isValidAbort: true
    },
    timeoutRetryRoute: {
      workloads: [],
      isTimeout: false,
      timeout: '2s',
      isValidTimeout: true,
      isRetry: false,
      retries: {
        attempts: 3,
        perTryTimeout: '2s',
        retryOn: 'gateway-error,connect-failure,refused-stream'
      },
      isValidRetry: true
    },
    valid: {
      mainWizard: true,
      vsHosts: true,
      tls: true,
      lb: true,
      gateway: true,
      cp: true,
      od: true
    },
    advancedOptionsValid: true,
    vsHosts: [fqdnServiceName],
    trafficPolicy: {
      tlsModified: false,
      mtlsMode: UNSET,
      clientCertificate: '',
      privateKey: '',
      caCertificates: '',
      addLoadBalancer: false,
      simpleLB: false,
      consistentHashType: ConsistentHashType.HTTP_HEADER_NAME,
      loadBalancer: {
        simple: ROUND_ROBIN
      },
      peerAuthnSelector: {
        addPeerAuthentication: false,
        addPeerAuthnModified: false,
        mode: PeerAuthenticationMutualTLSMode.UNSET
      },
      addConnectionPool: false,
      connectionPool: {},
      addOutlierDetection: false,
      outlierDetection: {}
    },
    gateway: undefined
  };
};

const advancedOptionsStyle = style({
  marginTop: 10
});

class ServiceWizard extends React.Component<ServiceWizardProps, ServiceWizardState> {
  constructor(props: ServiceWizardProps) {
    super(props);
    this.state = emptyServiceWizardState(fqdnServiceName(props.serviceName, props.namespace));
  }

  componentDidUpdate(prevProps: ServiceWizardProps) {
    if (prevProps.show !== this.props.show || !this.compareWorkloads(prevProps.workloads, this.props.workloads)) {
      let isMainWizardValid: boolean;
      switch (this.props.type) {
        // By default the rule of Weighted routing should be valid
        case WIZARD_TRAFFIC_SHIFTING:
          isMainWizardValid = true;
          break;
        // By default no rules is a no valid scenario
        case WIZARD_REQUEST_ROUTING:
          isMainWizardValid = false;
          break;
        case WIZARD_FAULT_INJECTION:
        case WIZARD_REQUEST_TIMEOUTS:
        default:
          isMainWizardValid = true;
          break;
      }
      const initVsHosts = getInitHosts(this.props.virtualServices);
      const [initMtlsMode, initClientCertificate, initPrivateKey, initCaCertificates] = getInitTlsMode(
        this.props.destinationRules
      );
      const initLoadBalancer = getInitLoadBalancer(this.props.destinationRules);
      let initConsistentHashType = ConsistentHashType.HTTP_HEADER_NAME;
      if (initLoadBalancer && initLoadBalancer.consistentHash) {
        if (initLoadBalancer.consistentHash.httpHeaderName) {
          initConsistentHashType = ConsistentHashType.HTTP_HEADER_NAME;
        } else if (initLoadBalancer.consistentHash.httpCookie) {
          initConsistentHashType = ConsistentHashType.HTTP_COOKIE;
        } else if (initLoadBalancer.consistentHash.useSourceIp) {
          initConsistentHashType = ConsistentHashType.USE_SOURCE_IP;
        }
      }

      const initPeerAuthentication = getInitPeerAuthentication(
        this.props.destinationRules,
        this.props.peerAuthentications
      );
      const initConnetionPool = getInitConnectionPool(this.props.destinationRules);
      const initOutlierDetection = getInitOutlierDetection(this.props.destinationRules);
      const trafficPolicy: TrafficPolicyState = {
        tlsModified: initMtlsMode !== '',
        mtlsMode: initMtlsMode !== '' ? initMtlsMode : UNSET,
        clientCertificate: initClientCertificate,
        privateKey: initPrivateKey,
        caCertificates: initCaCertificates,
        addLoadBalancer: initLoadBalancer !== undefined,
        simpleLB: initLoadBalancer !== undefined && initLoadBalancer.simple !== undefined,
        consistentHashType: initConsistentHashType,
        loadBalancer: initLoadBalancer
          ? initLoadBalancer
          : {
              simple: ROUND_ROBIN
            },
        peerAuthnSelector: {
          addPeerAuthentication: initPeerAuthentication !== undefined,
          addPeerAuthnModified: false,
          mode: initPeerAuthentication || PeerAuthenticationMutualTLSMode.UNSET
        },
        addConnectionPool: initConnetionPool ? true : false,
        connectionPool: initConnetionPool
          ? initConnetionPool
          : {
              tcp: {
                maxConnections: 1
              },
              http: {
                http1MaxPendingRequests: 1
              }
            },
        addOutlierDetection: initOutlierDetection ? true : false,
        outlierDetection: initOutlierDetection
          ? initOutlierDetection
          : {
              consecutiveErrors: 1
            }
      };
      const gateway: GatewaySelectorState = {
        addGateway: false,
        gwHosts: '',
        gwHostsValid: false,
        newGateway: false,
        selectedGateway: '',
        addMesh: false,
        port: 80
      };
      if (hasGateway(this.props.virtualServices)) {
        const [gatewaySelected, isMesh] = getInitGateway(this.props.virtualServices);
        gateway.addGateway = true;
        gateway.selectedGateway = gatewaySelected;
        gateway.addMesh = isMesh;
      }

      this.setState({
        showWizard: this.props.show,
        showPreview: false,
        workloads: [],
        rules: [],
        valid: {
          mainWizard: isMainWizardValid,
          vsHosts: true,
          tls: true,
          lb: true,
          gateway: true,
          cp: true,
          od: true
        },
        vsHosts:
          initVsHosts.length > 1 || (initVsHosts.length === 1 && initVsHosts[0].length > 0)
            ? initVsHosts
            : [fqdnServiceName(this.props.serviceName, this.props.namespace)],
        trafficPolicy: trafficPolicy,
        gateway: gateway
      });
    }
  }

  compareWorkloads = (prev: WorkloadOverview[], current: WorkloadOverview[]): boolean => {
    if (prev.length !== current.length) {
      return false;
    }
    for (let i = 0; i < prev.length; i++) {
      if (!current.some(w => _.isEqual(w, prev[i]))) {
        return false;
      }
    }
    return true;
  };

  onClose = (changed: boolean) => {
    this.setState(emptyServiceWizardState(fqdnServiceName(this.props.serviceName, this.props.namespace)));
    this.props.onClose(changed);
  };

  onCreateUpdate = () => {
    const promises: Promise<Response<string>>[] = [];
    switch (this.props.type) {
      case WIZARD_TRAFFIC_SHIFTING:
      case WIZARD_TCP_TRAFFIC_SHIFTING:
      case WIZARD_REQUEST_ROUTING:
      case WIZARD_FAULT_INJECTION:
      case WIZARD_REQUEST_TIMEOUTS:
        const dr = this.state.previews!.dr;
        const vs = this.state.previews!.vs;
        const gw = this.state.previews!.gw;
        const pa = this.state.previews!.pa;
        // Gateway is only created when user has explicit selected this option
        if (gw) {
          promises.push(API.createIstioConfigDetail(this.props.namespace, 'gateways', JSON.stringify(gw)));
        }

        if (this.props.update) {
          promises.push(
            API.updateIstioConfigDetail(this.props.namespace, 'destinationrules', dr.metadata.name, JSON.stringify(dr))
          );
          promises.push(
            API.updateIstioConfigDetail(this.props.namespace, 'virtualservices', vs.metadata.name, JSON.stringify(vs))
          );

          this.handlePeerAuthnUpdate(pa, dr, promises);
          // Note that Gateways are not updated from the Wizard, only the VS hosts/gateways sections are updated
        } else {
          promises.push(API.createIstioConfigDetail(this.props.namespace, 'destinationrules', JSON.stringify(dr)));
          promises.push(API.createIstioConfigDetail(this.props.namespace, 'virtualservices', JSON.stringify(vs)));

          if (pa) {
            promises.push(API.createIstioConfigDetail(this.props.namespace, 'peerauthentications', JSON.stringify(pa)));
          }
        }
        break;
      default:
    }
    // Disable button before promise is completed. Then Wizard is closed.
    this.setState(prevState => {
      prevState.valid.mainWizard = false;
      return {
        valid: prevState.valid
      };
    });
    Promise.all(promises)
      .then(results => {
        if (results.length > 0) {
          AlertUtils.add(
            'Istio Config ' +
              (this.props.update ? 'updated' : 'created') +
              ' for ' +
              this.props.serviceName +
              ' service.',
            'default',
            MessageType.SUCCESS
          );
        }
        this.onClose(true);
      })
      .catch(error => {
        AlertUtils.addError('Could not ' + (this.props.update ? 'update' : 'create') + ' Istio config objects.', error);
        this.onClose(true);
      });
  };

  handlePeerAuthnUpdate = (
    pa: PeerAuthentication | undefined,
    dr: DestinationRule,
    promises: Promise<Response<string>>[]
  ): void => {
    if (pa) {
      if (this.state.trafficPolicy.peerAuthnSelector.addPeerAuthnModified) {
        promises.push(API.createIstioConfigDetail(this.props.namespace, 'peerauthentications', JSON.stringify(pa)));
      } else {
        promises.push(
          API.updateIstioConfigDetail(this.props.namespace, 'peerauthentications', dr.metadata.name, JSON.stringify(pa))
        );
      }
    } else if (this.state.trafficPolicy.peerAuthnSelector.addPeerAuthnModified) {
      promises.push(API.deleteIstioConfigDetail(this.props.namespace, 'peerauthentications', dr.metadata.name));
    }
  };

  onVsHosts = (valid: boolean, vsHosts: string[]) => {
    this.setState(prevState => {
      prevState.valid.vsHosts = valid;
      if (prevState.gateway && prevState.gateway.addGateway && prevState.gateway.newGateway) {
        prevState.gateway.gwHosts = vsHosts.join(',');
      }
      // Check if Gateway is valid after a VsHosts check
      if (valid && !prevState.valid.gateway) {
        const hasVsWildcard = vsHosts.some(h => h === '*');
        if (hasVsWildcard) {
          if (prevState.gateway && !prevState.gateway.addMesh) {
            prevState.valid.gateway = true;
          }
        } else {
          // If no wildcard Gateway should be ok
          prevState.valid.gateway = true;
        }
      }
      return {
        valid: prevState.valid,
        vsHosts: vsHosts
      };
    });
  };

  onTrafficPolicy = (valid: boolean, trafficPolicy: TrafficPolicyState) => {
    this.setState(prevState => {
      // At the moment this callback only updates the valid of the loadbalancer
      // tls is always true, but I maintain it on the structure for consistency
      prevState.valid.tls = valid;
      prevState.valid.lb = valid;
      return {
        valid: prevState.valid,
        trafficPolicy: trafficPolicy
      };
    });
  };

  onCircuitBreaker = (circuitBreaker: CircuitBreakerState) => {
    this.setState(prevState => {
      prevState.valid.cp = circuitBreaker.isValidConnectionPool;
      prevState.valid.od = circuitBreaker.isValidOutlierDetection;
      prevState.trafficPolicy.addConnectionPool = circuitBreaker.addConnectionPool;
      prevState.trafficPolicy.connectionPool = circuitBreaker.connectionPool;
      prevState.trafficPolicy.addOutlierDetection = circuitBreaker.addOutlierDetection;
      prevState.trafficPolicy.outlierDetection = circuitBreaker.outlierDetection;
      return {
        valid: prevState.valid,
        trafficPolicy: prevState.trafficPolicy
      };
    });
  };

  onGateway = (valid: boolean, gateway: GatewaySelectorState) => {
    this.setState(prevState => {
      prevState.valid.gateway = valid;
      return {
        valid: prevState.valid,
        gateway: gateway,
        vsHosts:
          gateway.addGateway && gateway.newGateway && gateway.gwHosts.length > 0
            ? gateway.gwHosts.split(',')
            : prevState.vsHosts
      };
    });
  };

  onWeightsChange = (valid: boolean, workloads: WorkloadWeight[]) => {
    this.setState(prevState => {
      prevState.valid.mainWizard = valid;
      return {
        valid: prevState.valid,
        workloads: workloads
      };
    });
  };

  onRulesChange = (valid: boolean, rules: Rule[]) => {
    this.setState(prevState => {
      prevState.valid.mainWizard = valid;
      return {
        valid: prevState.valid,
        rules: rules
      };
    });
  };

  onFaultInjectionRouteChange = (valid: boolean, faultInjectionRoute: FaultInjectionRoute) => {
    this.setState(prevState => {
      prevState.valid.mainWizard = valid;
      return {
        valid: prevState.valid,
        faultInjectionRoute: faultInjectionRoute
      };
    });
  };

  onTimeoutRetryRouteChange = (valid: boolean, timeoutRetryRoute: TimeoutRetryRoute) => {
    this.setState(prevState => {
      prevState.valid.mainWizard = valid;
      return {
        valid: prevState.valid,
        timeoutRetryRoute: timeoutRetryRoute
      };
    });
  };

  isValid = (state: ServiceWizardState): boolean => {
    return (
      state.valid.mainWizard &&
      state.valid.vsHosts &&
      state.valid.tls &&
      state.valid.lb &&
      state.valid.gateway &&
      state.valid.cp &&
      state.valid.od
    );
  };

  advancedHandleTabClick = (_event, tabIndex) => {
    this.setState({
      advancedTabKey: tabIndex
    });
  };

  onPreview = () => {
    this.setState(
      {
        previews: buildIstioConfig(this.props, this.state)
      },
      () => this.setState({ showPreview: true })
    );
  };

  onConfirmPreview = (items: ConfigPreviewItem[]) => {
    const dr = items.filter(it => it.type === 'destinationrule')[0];
    const gw = items.filter(it => it.type === 'gateway')[0];
    const pa = items.filter(it => it.type === 'peerauthentications')[0];
    const vs = items.filter(it => it.type === 'virtualservice')[0];
    const previews: WizardPreviews = {
      dr: dr.items[0] as DestinationRule,
      gw: gw ? (gw.items[0] as Gateway) : undefined,
      pa: pa ? (pa.items[0] as PeerAuthentication) : undefined,
      vs: vs.items[0] as VirtualService
    };
    this.setState({ previews, showPreview: false, showWizard: false, confirmationModal: true });
  };

  getItems = () => {
    const items: ConfigPreviewItem[] = [];
    if (this.state.previews) {
      if (this.state.previews.dr) {
        items.push({ type: 'destinationrule', items: [this.state.previews.dr], title: 'Destination Rule' });
      }
      if (this.state.previews.gw) {
        items.push({ type: 'gateway', items: [this.state.previews.gw], title: 'Gateway' });
      }
      if (this.state.previews.pa) {
        items.push({ type: 'peerauthentications', items: [this.state.previews.pa], title: 'Peer Authentication' });
      }
      if (this.state.previews.vs) {
        items.push({ type: 'virtualservice', items: [this.state.previews.vs], title: 'VirtualService' });
      }
    }

    return items;
  };

  render() {
    const [gatewaySelected, isMesh] = getInitGateway(this.props.virtualServices);
    const titleAction =
      this.props.type.length > 0
        ? this.props.update
          ? 'Update ' + WIZARD_TITLES[this.props.type]
          : 'Create ' + WIZARD_TITLES[this.props.type]
        : '';
    const titleModal = this.props.type.length > 0
      ? this.props.update
        ? 'Update ' + WIZARD_TITLES[this.props.type]
        : 'Create ' + WIZARD_TITLES[this.props.type]
      : '';
    return (
      <>
        <Modal
          variant={ModalVariant.small}
          title={titleAction}
          isOpen={this.state.confirmationModal}
          onClose={() => this.onClose(false)}
          actions={[
            <Button key="cancel" variant="secondary" onClick={() => this.onClose(false)}>
              Cancel
            </Button>,
            <Button key="confirm" variant={'primary'} onClick={this.onCreateUpdate} data-test={'confirm-' + (this.props.update ? 'update' : 'create')}>
              {this.props.update ? 'Update' : 'Create'}
            </Button>
          ]}
        >
          <>
            You're going to {this.props.update ? 'update' : 'create'} istio objects in Namespace {this.props.namespace}.
            Are you sure?
          </>
        </Modal>
        <Modal
          width={'75%'}
          title={titleModal}
          aria-label={titleModal}
          isOpen={this.state.showWizard}
          onClose={() => this.onClose(false)}
          onKeyPress={e => {
            if (e.key === 'Enter' && this.isValid(this.state)) {
              this.onPreview();
            }
          }}
          actions={[
            <Button key="cancel" variant="secondary" onClick={() => this.onClose(false)}>
              Cancel
            </Button>,
            <Button isDisabled={!this.isValid(this.state)} key="confirm" variant="primary" onClick={this.onPreview} data-test="preview">
              Preview
            </Button>
          ]}
        >
          <IstioConfigPreview
            isOpen={this.state.showPreview}
            title={titleAction}
            ns={this.props.namespace}
            opTarget={this.props.update ? 'update' : 'create'}
            disableAction={!this.props.createOrUpdate}
            items={this.getItems()}
            onClose={() => this.setState({ showPreview: false })}
            onConfirm={(items: ConfigPreviewItem[]) => {
              this.onConfirmPreview(items);
            }}
          />
          {this.props.type === WIZARD_REQUEST_ROUTING && (
            <RequestRouting
              serviceName={this.props.serviceName}
              workloads={this.props.workloads}
              initRules={getInitRules(this.props.workloads, this.props.virtualServices, this.props.destinationRules)}
              onChange={this.onRulesChange}
            />
          )}
          {this.props.type === WIZARD_FAULT_INJECTION && (
            <FaultInjection
              initFaultInjectionRoute={getInitFaultInjectionRoute(
                this.props.workloads,
                this.props.virtualServices,
                this.props.destinationRules
              )}
              onChange={this.onFaultInjectionRouteChange}
            />
          )}
          {(this.props.type === WIZARD_TRAFFIC_SHIFTING || this.props.type === WIZARD_TCP_TRAFFIC_SHIFTING) && (
            <TrafficShifting
              showValid={true}
              workloads={this.props.workloads}
              initWeights={getInitWeights(
                this.props.workloads,
                this.props.virtualServices,
                this.props.destinationRules
              )}
              showMirror={this.props.type === WIZARD_TRAFFIC_SHIFTING}
              onChange={this.onWeightsChange}
            />
          )}
          {this.props.type === WIZARD_REQUEST_TIMEOUTS && (
            <RequestTimeouts
              initTimeoutRetry={getInitTimeoutRetryRoute(
                this.props.workloads,
                this.props.virtualServices,
                this.props.destinationRules
              )}
              onChange={this.onTimeoutRetryRouteChange}
            />
          )}
          {(this.props.type === WIZARD_REQUEST_ROUTING ||
            this.props.type === WIZARD_FAULT_INJECTION ||
            this.props.type === WIZARD_TRAFFIC_SHIFTING ||
            this.props.type === WIZARD_TCP_TRAFFIC_SHIFTING ||
            this.props.type === WIZARD_REQUEST_TIMEOUTS) && (
            <ExpandableSection
              className={advancedOptionsStyle}
              isExpanded={this.state.showAdvanced}
              toggleText={(this.state.showAdvanced ? 'Hide' : 'Show') + ' Advanced Options'}
              contentId={(this.state.showAdvanced ? 'hide' : 'show') + '_advanced_options'}
              onToggle={() => {
                this.setState({
                  showAdvanced: !this.state.showAdvanced
                });
              }}
            >
              <Tabs isFilled={true} activeKey={this.state.advancedTabKey} onSelect={this.advancedHandleTabClick}>
                <Tab eventKey={0} title={'Destination Hosts'}>
                  <div style={{ marginTop: '20px' }}>
                    <VirtualServiceHosts
                      vsHosts={this.state.vsHosts}
                      gateway={this.state.gateway}
                      onVsHostsChange={this.onVsHosts}
                    />
                  </div>
                </Tab>
                <Tab eventKey={1} title={'Gateways'} data-test={'Gateways'}>
                  <div style={{ marginTop: '20px', marginBottom: '10px' }}>
                    <GatewaySelector
                      serviceName={this.props.serviceName}
                      hasGateway={hasGateway(this.props.virtualServices)}
                      gateway={gatewaySelected}
                      isMesh={isMesh}
                      gateways={this.props.gateways}
                      vsHosts={this.state.vsHosts}
                      onGatewayChange={this.onGateway}
                    />
                  </div>
                </Tab>
                <Tab eventKey={2} title={'Traffic Policy'}>
                  <div style={{ marginTop: '20px', marginBottom: '10px' }}>
                    <TrafficPolicyContainer
                      mtlsMode={this.state.trafficPolicy.mtlsMode}
                      clientCertificate={this.state.trafficPolicy.clientCertificate}
                      privateKey={this.state.trafficPolicy.privateKey}
                      caCertificates={this.state.trafficPolicy.caCertificates}
                      hasLoadBalancer={this.state.trafficPolicy.addLoadBalancer}
                      loadBalancer={this.state.trafficPolicy.loadBalancer}
                      nsWideStatus={this.props.tlsStatus}
                      hasPeerAuthentication={this.state.trafficPolicy.peerAuthnSelector.addPeerAuthentication}
                      peerAuthenticationMode={this.state.trafficPolicy.peerAuthnSelector.mode}
                      addConnectionPool={this.state.trafficPolicy.addConnectionPool}
                      connectionPool={this.state.trafficPolicy.connectionPool}
                      addOutlierDetection={this.state.trafficPolicy.addOutlierDetection}
                      outlierDetection={this.state.trafficPolicy.outlierDetection}
                      onTrafficPolicyChange={this.onTrafficPolicy}
                    />
                  </div>
                </Tab>
                {this.props.type !== WIZARD_TCP_TRAFFIC_SHIFTING && (
                  <Tab eventKey={3} title={'Circuit Breaker'}>
                    <div style={{ marginTop: '20px', marginBottom: '10px' }}>
                      <CircuitBreaker
                        hasConnectionPool={this.state.trafficPolicy.addConnectionPool}
                        connectionPool={this.state.trafficPolicy.connectionPool}
                        hasOutlierDetection={this.state.trafficPolicy.addOutlierDetection}
                        outlierDetection={this.state.trafficPolicy.outlierDetection}
                        onCircuitBreakerChange={this.onCircuitBreaker}
                      />
                    </div>
                  </Tab>
                )}
              </Tabs>
            </ExpandableSection>
          )}
        </Modal>
      </>
    );
  }
}

export default ServiceWizard;
