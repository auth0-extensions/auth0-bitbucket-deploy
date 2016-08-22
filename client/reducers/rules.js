import moment from 'moment';
import { fromJS } from 'immutable';

import * as constants from '../constants';
import createReducer from '../utils/createReducer';

const initialState = {
    loading: false,
    error: null,
    records: []
};

export const config = createReducer(fromJS(initialState), {
        [constants.FETCH_RULES_PENDING]: (state) =>
    state.merge({
        loading: true,
        record: []
    }),
    [constants.FETCH_RULES_REJECTED]: (state, action) =>
    state.merge({
        loading: false,
        error: `An error occured while loading the rule: ${action.payload.data && action.payload.data.message || action.payload.statusText}`
    }),
        [constants.FETCH_DEPLOYMENTS_FULFILLED]: (state, action) => {
    const { data } = action.payload;
    return state.merge({
        loading: false,
        records: state.get('records').concat(fromJS(data.map(deployment => {
            deployment.date_relative = moment(deployment.date).fromNow();
    return deployment;
    })))
    })
    }
});
