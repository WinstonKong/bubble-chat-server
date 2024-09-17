export const Logger = {
  error: function (message?: any, ...optionalParams: any[]) {
    console.error(message, ...optionalParams);
  },
  log: function (message?: any, ...optionalParams: any[]) {
    console.log(message, ...optionalParams);
  },
};
