﻿/*global define */
define(['services/session', 'plugins/http', 'jquery', 'config/httpServiceApiLinks', 'common/loadingMask/loadingMask', '../shell', 'services/logger', 'i18n'],
  function (session, http, $, httpServiceApiLinks, loadingMask, shell, logger, i18n) {
    'use strict';

    var TIMEOUT = 30000;
    var userInfoUrl = 'account/userinfo';

    var securityDomainLink = httpServiceApiLinks.security;
    var changePasswordUrl = securityDomainLink + 'api/Account/changePassword';
    var loginUrl = securityDomainLink + 'token';
    var logoutUrl = securityDomainLink + 'api/account/logout';
    var requestsCount = 0;

    var showLoadingMask = function () {
      requestsCount += 1;
      loadingMask.show();
    }

    var hideLoadingMask = function () {
      requestsCount -= 1;
      if (requestsCount === 0) {
        loadingMask.hide();
      } else if (requestsCount < 0){
        throw new Exception("Ups... This should never happend! Fix it Luke!");
      }
    }

    var convertToArray = function (value) {
      var result = value || [];
      if (typeof result === 'string') {
        return result.split(',');
      }

      return result;
    }

    var getSecurityHeaders = function () {
      var accessToken = session.rememberedToken();
      if (accessToken) {
        return {
          'Authorization': 'Bearer ' + accessToken
        };
      }

      return {};
    };

    var proccessFailReq = function (jqXHR, textStatus, errorThrown) {
      if (jqXHR.status === 401) {
        logger.warn({message: i18n.t('app:yourSessionTimedOut')});
        shell.logout();
      } else if (jqXHR.status === 403) {
        logger.warn({message: i18n.t('app:accessDenied')});
      }
    };

    var downloadFile = function (url, method, data) {
      var authHeaderValue = getSecurityHeaders();//'Bearer' + this.token;

      var deferred = $.Deferred(function (defer) {
        var xmlhttp = new XMLHttpRequest();
        xmlhttp.open(method, url, true);
        xmlhttp.timeout = TIMEOUT;
        xmlhttp.setRequestHeader('Content-Type', 'application/json;charset=UTF-8');
        xmlhttp.setRequestHeader('Authorization', authHeaderValue.Authorization);
        xmlhttp.responseType = "blob";

        xmlhttp.onload = function (oEvent) {
          if (this.status !== 200) {
            defer.reject({statusCode: this.status});
            return;
          }

          var blob = xmlhttp.response;
          var windowUrl = window.URL || window.webkitURL;
          var url = windowUrl.createObjectURL(blob);
          var filename = this.getResponseHeader('Content-Disposition').match(/^attachment; filename=(.+)/)[1];

          var anchor = $('<a></a>');
          anchor.prop('href', url);
          anchor.prop('download', filename);
          $('body').append(anchor);
          anchor.get(0).click();
          windowUrl.revokeObjectURL(url);
          anchor.remove();
        };

        xmlhttp.ontimeout = function () {
          defer.reject({timeout: true})
        };

        xmlhttp.addEventListener("error", function () {
          defer.reject();
        });
        xmlhttp.addEventListener("load", function () {
          defer.resolve();
        });
        if (method === 'GET') {
          xmlhttp.send();
        } else if (method === 'POST') {
          xmlhttp.send(JSON.stringify(data));
        } else {
          throw new Error("Unsuported method call!");
        }
      });

      deferred.fail(errorHandler.bind(this));

      return deferred;
    };

    var errorHandler = function errorHandler(response) {
      if (response.statusCode === 401) {
        logger.warn({message: i18n.t('common.sessionTimedOut')});
      } else if (response.statusCode === 403) {
        logger.warn({message: i18n.t('common.accessDenied')});
      } else if (response.statusCode === 500) {
        logger.error({message: i18n.t('common.internalServerError')});
      } else if (response.timeout === true) {
        logger.error({message: i18n.t('common.requestTimeout')});
      } else {
        logger.error('TODO: Implement ajax fails!');
      }
    };

    var getUrl = function (url, host) {
      var requestUrl;
      if (host) {
        requestUrl = host + url;
      } else {
        requestUrl = httpServiceApiLinks.root + url;
      }

      return requestUrl;
    }

    return {
      post: function (url, data, host) {
        var headers = getSecurityHeaders();
        showLoadingMask();
        var requestUrl = getUrl(url, host);
        var req = http.post(requestUrl, data, headers);
        req.fail(proccessFailReq);
        req.always(hideLoadingMask());

        return req;
      },
      get: function (url, data, host) {
        var headers = getSecurityHeaders();
        showLoadingMask();
        var requestUrl = getUrl(url, host);
        var req = http.get(requestUrl, data, headers);
        req.fail(proccessFailReq);
        req.always(hideLoadingMask());

        return req;
      },
      put: function (url, data, host) {
        var headers = getSecurityHeaders();
        showLoadingMask();
        var requestUrl = getUrl(url, host);
        var req = http.put(requestUrl, data, headers);
        req.fail(proccessFailReq);
        req.always(hideLoadingMask);

        return req;
      },
      remove: function (url, data, host) {
        var headers = getSecurityHeaders();
        showLoadingMask();
        var requestUrl = getUrl(url, host);
        var req = $.ajax({
          headers: headers,
          type: 'DELETE',
          url: requestUrl,
          contentType: 'application/json',
          dataType: 'json',
          traditional: true,
          data: JSON.stringify(data)
        });
        req.fail(proccessFailReq);
        req.always(hideLoadingMask());


        return req;
      },
      postDownloadFile: function (url, data, host) {
        showLoadingMask();
        var requestUrl = getUrl(url, host);
        var download = downloadFile(requestUrl, 'POST', data);
        hideLoadingMask();
        return download;
      },
      getDownloadFile: function (url, host) {
        showLoadingMask();
        var requestUrl = getUrl(url, host);
        var download = downloadFile(requestUrl, 'GET');
        hideLoadingMask();
        return download;
      },
      getUserInfo: function () {
        var headers = getSecurityHeaders();
        showLoadingMask();
        var requestUrl = httpServiceApiLinks.root + userInfoUrl;

        return $.ajax(requestUrl, {
          cache: false,
          headers: headers
        }).always(hideLoadingMask());

      },
      multipartFormPost: function (url, data, host) {
        var headers = getSecurityHeaders();
        showLoadingMask();
        var requestUrl = getUrl(url, host);

        var req = $.ajax({
          url: requestUrl,
          data: data,
          processData: false,
          contentType: false,
          type: 'POST',
          headers: headers
        });
        req.always(hideLoadingMask());
        return req;
      },
      securityService: {
        changePassword: function changePassword(data) {
          var headers = this.getSecurityHeaders();
          showLoadingMask();
          return $.ajax(changePasswordUrl, {
            type: 'POST',
            data: data,
            headers: headers
          }).always(hideLoadingMask());
        },
        login: function (data) {
          showLoadingMask();

          var req = $.ajax(loginUrl, {
            type: 'POST',
            data: data
          }).always(hideLoadingMask());
          req.fail(proccessFailReq);

          return req.done(function (data) {
            session.setUser({
              token: data.access_token,
              userName: data.userName || 'please give me a name!',
              userClaims: JSON.parse(data.userClaims || '[]'),
              userRoles: convertToArray(data.userRoles),
              userAccessRights: convertToArray(data.userAccessRights)
            });
          });
        },
        logout: function logout() {
          var headers = this.getSecurityHeaders();
          showLoadingMask();

          return $.ajax(logoutUrl, {
            type: 'POST',
            headers: headers
          }).always(hideLoadingMask());
        }
      }
    };
  });

