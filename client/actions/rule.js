import axios from 'axios';
import * as constants from '../constants';

/*
 * Load the rules.
 */
export function fetchAllRules() {
    return {
        type: constants.FETCH_RULES,
        payload: {
            promise: axios.get('/api/rules', {
                timeout: 5000,
                responseType: 'json'
            })
        }
    };
}

export function fetchManualRules() {
    return {
        type: constants.FETCH_MANUAL_RULES,
        payload: {
            promise: axios.get('/api/rules/manual', {
                timeout: 5000,
                responseType: 'json'
            })
        }
    };
}

export function updateRules(data, onSuccess) {
    return (dispatch) =>
    {
        dispatch({
            type: constants.UPDATE_MANUAL_RULES,
            meta: {
                onSuccess: () => {
                onSuccess();
                },
                onError: ()=>{
                onSuccess();
                }
                },
            payload: {
            promise: axios.post('/api/rules/', data , {
                responseType: 'json'
            })
        }
    });
    };
}