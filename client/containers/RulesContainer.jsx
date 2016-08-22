import React, { PropTypes, Component } from 'react';
import { Button, ButtonToolbar } from 'react-bootstrap';
import connectContainer from 'redux-static';

import { ruleActions } from '../actions';

import { Error, LoadingPanel } from '../components/Dashboard';
import RulesTable from '../components/RulesTable';

export default connectContainer(class extends Component {
  static stateToProps = (state) => ({
  });

  static actionsToProps = {
    ...ruleActions
  }

  static propTypes = {
    //rules: PropTypes.object.isRequired,
    fetchAllRules: PropTypes.func.isRequired,
    fetchManualRules: PropTypes.func.isRequired,
    updateRules: PropTypes.func.isRequired
  }

  componentWillMount() {
    this.props.fetchAllRules();
  }

  render() {
    const error = null;
    const loading = false;
    const rules = [
      {
        "id": "rul_16l4CZEi4J4gT3XP",
        "enabled": false,
        "script": "//rev 2\nfunction (user, context, callback) {\n\tif (context.request.geoip) {\t\n\t\tuser.country = context.request.geoip.country_name;\n\t}\t\t\t\t\n\tcallback(null, user, context);\t\t\t\t\n\t\n}",
        "name": "set-country",
        "order": 17,
        "stage": "login_success"
      },
      {
        "id": "rul_WxO229UXMT9uRudD",
        "enabled": false,
        "script": "function (user, context, callback) {\n\n  //var CLIENTS_WITH_MFA = ['{REPLACE_WITH_YOUR_CLIENT_ID}'];\n  // run only for the specified clients\n  // if (CLIENTS_WITH_MFA.indexOf(context.clientID) !== -1) {\n    // uncomment the following if clause in case you want to request a second factor only from user's that have user_metadata.use_mfa === true\n    // if (user.user_metadata && user.user_metadata.use_mfa){\n      context.multifactor = {\n        provider: 'guardian', //required\n\n        ignoreCookie: true, // optional. Force Auth0 MFA everytime this rule runs. Defaults to false. if accepted by users the cookie lasts for 30 days (this cannot be changed)\n      };\n    // }\n  //}\n\n  callback(null, user, context);\n}",
        "name": "Multifactor-Guardian-Do-Not-Rename",
        "order": 18,
        "stage": "login_success"
      }
    ];
    return (
      <div>
        <LoadingPanel show={loading} animationStyle={{ paddingTop: '5px', paddingBottom: '5px' }}>
          <div className="row">
            <div className="col-xs-12">
              <Error message={error} />
              <RulesTable rules={rules} loading={loading} error={error} saveManualRules={this.props.updateRules} />
            </div>
          </div>
        </LoadingPanel>
      </div>
    );
  }
});
