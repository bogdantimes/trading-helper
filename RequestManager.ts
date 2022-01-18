class RequestManager {
  private baseUrl: string;
  private authorization: string;
  private requestAttempts: number;
  private fetchRetryInterval: number;
  private cookie: string;

  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.authorization = null;
    this.requestAttempts = 1;
    this.fetchRetryInterval = 1000;
  }

  setRequestAttempts(requestAttempts) {
    this.requestAttempts = requestAttempts;
  }

  setFetchRetryInterval(interval_ms) {
    this.fetchRetryInterval = interval_ms;
  }

  setAuthorization(authorization) {
    this.authorization = authorization;
  }

  setCookie(cookie) {
    this.cookie = cookie;
  }

  fetch(resource, options) {
    const response = this.fetchRaw(resource, options);
    const dataAsString = response.getBlob().getDataAsString();
    try {
      return JSON.parse(dataAsString);
    } catch (e) {
      return dataAsString;
    }
  }

  fetchRaw(resource, options) {
    const authOptions = this.addAuthorization(options);
    const authCookieOptions = this.addCookie(authOptions);
    return execute({
      context: this,
      interval: this.fetchRetryInterval,
      attempts: this.requestAttempts,
      runnable(context) {
        return UrlFetchApp.fetch(context.baseUrl + '/' + resource, authCookieOptions);
      },
    });
  }

  post(resource, options) {
    const postOptions = Object.assign({}, options, {method: 'post'});
    return this.fetch(resource, postOptions);
  }

  put(resource, options) {
    const postOptions = Object.assign({}, options, {method: 'put'});
    return this.fetch(resource, postOptions);
  }

  get(resource, options?: object, queryParams?: object) {
    const queryString = this._createQueryString(queryParams);
    return this.fetch(resource + queryString, options);
  }

  remove(resource, id) {
    const deleteOptions = {method: 'delete'};
    return this.fetch(id ? resource + '/' + id : resource, deleteOptions);
  }

  postJson(resource, data) {
    const options = {
      contentType: 'application/json',
      payload: JSON.stringify(data),
    };
    return this.post(resource, options);
  }

  putJson(resource, data) {
    const options = {
      contentType: 'application/json',
      payload: JSON.stringify(data),
    };
    return this.put(resource, options);
  }

  addAuthorization(options) {
    return this.addHeader(options, 'Authorization', this.authorization);
  }

  addCookie(options) {
    return this.addHeader(options, 'cookie', this.cookie);
  }

  addHeader(options, headerName, value) {
    const copy = Object.assign({}, options);
    if (value) {
      const addedHeader = {};
      addedHeader[headerName] = value;
      copy.headers = Object.assign({}, copy.headers, addedHeader);
    }
    return copy;
  }

  _createQueryString(queryParams) {
    const queryParamItems = [];
    let queryString = '';
    if (queryParams) {
      Object.keys(queryParams).forEach(key => {
        const value = queryParams[key];
        if (value) {
          queryParamItems.push([key, encodeURIComponent(value)].join('='));
        }
      });
      if (queryParamItems) {
        queryString += '?' + queryParamItems.join('&');
      }
    }
    return queryString;
  }
}

