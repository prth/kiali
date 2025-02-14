import * as React from 'react';
import { Button, Tabs, Tab } from '@patternfly/react-core';
import MatchBuilder from './MatchBuilder';
import Matches from './Matches';
import { style } from 'typestyle';
import { WorkloadOverview } from '../../../types/ServiceInfo';
import TrafficShifting, { WorkloadWeight } from '../TrafficShifting';
import FaultInjection, { FaultInjectionRoute } from '../FaultInjection';
import { PFColors } from '../../Pf/PfColors';
import RequestTimeouts, { TimeoutRetryRoute } from '../RequestTimeouts';

type Props = {
  // MatchBuilder props
  category: string;
  operator: string;
  headerName: string;
  matchValue: string;
  isValid: boolean;
  onSelectCategory: (category: string) => void;
  onHeaderNameChange: (headerName: string) => void;
  onSelectOperator: (operator: string) => void;
  onMatchValueChange: (matchValue: string) => void;
  onAddMatch: () => void;

  // Matches props
  matches: string[];
  onRemoveMatch: (match: string) => void;

  workloads: WorkloadOverview[];
  weights: WorkloadWeight[];
  onSelectWeights: (valid: boolean, workloads: WorkloadWeight[]) => void;

  faultInjectionRoute: FaultInjectionRoute;
  onSelectFaultInjection: (valid: boolean, faultInjectionRoute: FaultInjectionRoute) => void;

  timeoutRetryRoute: TimeoutRetryRoute;
  onSelectTimeoutRetry: (valid: boolean, timeoutRetryRoute: TimeoutRetryRoute) => void;

  // RuleBuilder
  validationMsg: string;
  onAddRule: () => void;
};

type State = {
  isWorkloadSelector: boolean;
  ruleTabKey: number;
};

const addRuleStyle = style({
  width: '100%',
  textAlign: 'right'
});

const validationStyle = style({
  marginRight: 20,
  color: PFColors.Red100,
  display: 'inline'
});

class RuleBuilder extends React.Component<Props, State> {
  constructor(props) {
    super(props);
    this.state = {
      isWorkloadSelector: false,
      ruleTabKey: 0
    };
  }

  onWorkloadsToggle = () => {
    this.setState({
      isWorkloadSelector: !this.state.isWorkloadSelector
    });
  };

  ruleHandleTabClick = (_event, tabIndex) => {
    this.setState({
      ruleTabKey: tabIndex
    });
  };

  render() {
    return (
      <>
        <Tabs isFilled={true} activeKey={this.state.ruleTabKey} onSelect={this.ruleHandleTabClick}>
          <Tab eventKey={0} title={'Request Matching'} data-test={'Request Matching'}>
            <div style={{ marginTop: '20px' }}>
              <MatchBuilder {...this.props} />
              <Matches {...this.props} />
            </div>
          </Tab>
          <Tab eventKey={1} title={'Route To'} data-test={'Route To'}>
            <div
              style={{
                marginBottom: '10px'
              }}
            >
              <TrafficShifting
                showValid={false}
                workloads={this.props.workloads}
                initWeights={this.props.weights}
                showMirror={true}
                onChange={this.props.onSelectWeights}
              />
            </div>
          </Tab>
          <Tab eventKey={2} title={'Fault Injection'} data-test={'Fault Injection'}>
            <div style={{ marginTop: '10px' }}>
              <FaultInjection
                initFaultInjectionRoute={this.props.faultInjectionRoute}
                onChange={this.props.onSelectFaultInjection}
              />
            </div>
          </Tab>
          <Tab eventKey={3} title={'Request Timeouts'} data-test={'Request Timeouts'}>
            <div style={{ marginTop: '10px' }}>
              <RequestTimeouts
                initTimeoutRetry={this.props.timeoutRetryRoute}
                onChange={this.props.onSelectTimeoutRetry}
              />
            </div>
          </Tab>
        </Tabs>
        <div className={addRuleStyle}>
          <span>
            {this.props.validationMsg.length > 0 && <div className={validationStyle}>{this.props.validationMsg}</div>}
            <Button variant="secondary" isDisabled={!this.props.isValid} onClick={this.props.onAddRule} data-test="add-route">
              Add Route Rule
            </Button>
          </span>
        </div>
      </>
    );
  }
}

export default RuleBuilder;
