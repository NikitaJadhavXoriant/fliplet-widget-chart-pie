window.ui = window.ui || {};
ui.flipletCharts = ui.flipletCharts || {};

Fliplet.Widget.instance('chart-pie-1-1-0', function(data) {
  var chartId = data.id;
  var chartUuid = data.uuid;
  var $container = $(this);
  var themeInstance = Fliplet.Themes && Fliplet.Themes.Current.getInstance();
  var themeValues;

  if (themeInstance) {
    Object.assign({}, themeInstance.data.values);

    var themeValue = themeInstance.data.values || {};
    var widgetValue = getColors(themeInstance.data.widgetInstances);

    if ((themeInstance.data.widgetInstances || []).length) {
      var instanceFound = _.some(themeInstance.data.widgetInstances, function(widgetProp) {
        if (chartId === widgetProp.id) {
          themeValues = Object.assign(themeValue, widgetValue);
          Object.assign(widgetProp.values, themeValues);

          return true;
        }
      });

      if (!instanceFound) {
        themeValues = Object.assign({}, themeValue);
      }
    } else {
      themeValues = Object.assign(themeValue, widgetValue);
    }
  }

  var inheritColor1 = true;
  var inheritColor2 = true;
  var refreshTimeout = 5000;
  var refreshTimer;
  var defaultColors = [
    '#00abd1', '#ed9119', '#7D4B79', '#F05865', '#36344C',
    '#474975', '#8D8EA6', '#FF5722', '#009688', '#E91E63'
  ];
  var deviceType = getDeviceType();
  var deviceColors = {
    Mobile: [],
    Tablet: [],
    Desktop: []
  };
  var chartInstance;
  var chartReady;
  var chartPromise = new Promise(function(resolve) {
    chartReady = resolve;
  });

  Fliplet.Chart.add(chartPromise);

  function getDeviceType() {
    if (Modernizr.mobile) {
      return '';
    } else if (Modernizr.tablet) {
      return 'Tablet';
    }

    return 'Desktop';
  }

  function getColors(widgets) {
    var widgetColors = {};

    if (!widgets) {
      return widgetColors;
    }

    widgets.forEach(function(widget) {
      if (widget.id === chartId) {
        Object.assign(widgetColors, widget.values);
      }
    });

    return widgetColors;
  }

  function init() {
    function refreshData() {
      if (typeof data.dataSourceQuery !== 'object') {
        data.entries = [
          { name: 'A', y: 3 },
          { name: 'B', y: 2 },
          { name: 'C', y: 1 }
        ];
        data.totalEntries = 6;

        return Promise.resolve();
      }

      // beforeQueryChart is deprecated
      return Fliplet.Hooks.run('beforeQueryChart', data.dataSourceQuery).then(function() {
        return Fliplet.Hooks.run('beforeChartQuery', {
          config: data,
          id: data.id,
          uuid: data.uuid,
          name: data.chartName,
          type: 'pie'
        });
      }).then(function() {
        if (_.isFunction(data.getData)) {
          var response = data.getData();

          if (!(response instanceof Promise)) {
            return Promise.resolve(response);
          }

          return response;
        }

        return Fliplet.DataSources.fetchWithOptions(data.dataSourceQuery);
      }).then(function(result) {
        // afterQueryChart is deprecated
        return Fliplet.Hooks.run('afterQueryChart', result).then(function() {
          return Fliplet.Hooks.run('afterChartQuery', {
            config: data,
            id: data.id,
            uuid: data.uuid,
            name: data.chartName,
            type: 'pie',
            records: result
          });
        }).then(function() {
          var columns = [];

          data.entries = [];
          data.totalEntries = 0;

          if (!result.dataSource.columns.length) {
            return Promise.resolve();
          }

          switch (data.dataSourceQuery.selectedModeIdx) {
            case 0:
            default:
              // Plot the data as is
              data.name = data.dataSourceQuery.columns.category;
              result.dataSourceEntries.forEach(function(row, i) {
                data.entries.push({
                  name: row[data.dataSourceQuery.columns.category] || T('widgets.charts.pie.category', { count: i + 1 }),
                  y: parseInt(row[data.dataSourceQuery.columns.value], 10) || 0
                });
              });
              break;
            case 1:
              // Summarize data
              data.name = T('widgets.charts.pie.title', { name: data.dataSourceQuery.columns.column });
              result.dataSourceEntries.forEach(function(row) {
                var value = row[data.dataSourceQuery.columns.column];

                if (typeof value === 'string') {
                  value = $.trim(value);
                }

                if (!value) {
                  return;
                }

                if (!Array.isArray(value)) {
                  value = [value];
                }

                // Value is an array
                value.forEach(function(elem) {
                  if ( columns.indexOf(elem) === -1 ) {
                    columns.push(elem);
                    data.entries[columns.indexOf(elem)] = {
                      name: elem,
                      y: 1
                    };
                  } else {
                    data.entries[columns.indexOf(elem)].y++;
                  }
                });
              });

              return Fliplet.Hooks.run('afterChartSummary', {
                config: data,
                id: data.id,
                uuid: data.uuid,
                name: data.chartName,
                type: 'pie',
                records: result
              });
          }
        }).then(function() {
          data.entries = _.reverse(_.sortBy(data.entries, function(o) {
            return o.y;
          }));

          // SAVES THE TOTAL NUMBER OF ROW/ENTRIES
          data.totalEntries = _.reduce(data.entries, function(sum, o) {
            return sum + o.y;
          }, 0);

          return Promise.resolve();
        }).catch(function(error) {
          return Promise.reject(error);
        });
      });
    }

    function refreshChartInfo() {
      // Update total count
      $container.find('.total').html(TN(data.totalEntries));
      // Update last updated time
      $container.find('.updatedAt').html(TD(new Date(), { format: 'LTS' }));
    }

    function refreshChart() {
      // Retrieve chart object
      var chart = ui.flipletCharts[chartId];

      if (!chart) {
        return drawChart();
      }

      // Update values
      chart.series[0].setData(data.entries);
      refreshChartInfo();

      return Promise.resolve(chart);
    }

    function refresh() {
      if (refreshTimer) {
        clearTimeout(refreshTimer);
        refreshTimer = null;
      }

      return refreshData().then(function() {
        if (data.autoRefresh) {
          setRefreshTimer();
        }

        return refreshChart();
      }).catch(function(err) {
        if (data.autoRefresh) {
          setRefreshTimer();
        }

        return Promise.reject(err);
      });
    }

    function setRefreshTimer() {
      if (refreshTimer) {
        clearTimeout(refreshTimer);
      }

      refreshTimer = setTimeout(refresh, refreshTimeout);
    }

    function getThemeColor(colorKey, newColor, index, color) {
      if (themeValues && (themeValues.hasOwnProperty(colorKey) || themeValues[color])) {
        return themeValues[colorKey] || themeValues[color];
      } else if (Fliplet.Themes.Current.get(colorKey)) {
        return Fliplet.Themes.Current.get(colorKey);
      } else if (newColor) {
        return newColor;
      } else {
        var colors = defaultColors.slice();

        return colors[index];
      }
    }

    Fliplet.Studio.onEvent(function(event) {
      var eventDetail = event.detail;

      if (eventDetail && eventDetail.type === 'savingNewStyles') {
        if (eventDetail.widgetId && eventDetail.widgetId !== chartId) {
          return;
        }

        setThemeValues(eventDetail.data);
      }

      if (eventDetail && eventDetail.type === 'colorChange') {
        if (eventDetail.widgetId && eventDetail.widgetId !== chartId) {
          return;
        }

        var widgetColors = getWidgetColors(themeInstance.data.widgetInstances);

        if (!eventDetail.widgetMode && widgetColors[eventDetail.name + deviceType]) {
          return;
        }

        var colorIndex = null;

        switch (eventDetail.label) {
          case 'Highlight color':
            if (inheritColor1) {
              colorIndex = 0;
            }

            break;
          case 'Secondary color':
            if (inheritColor2) {
              colorIndex = 1;
            }

            break;
          case 'Chart color 1':
            inheritColor1 = false;
            break;
          case 'Chart color 2':
            inheritColor2 = false;
            break;
          default:
            break;
        }

        if (colorIndex === null) {
          var labelIndex = eventDetail.label.match(/[0-9]{1,2}/);

          if (labelIndex === null) {
            return;
          }

          colorIndex = labelIndex[0] - 1;
        }

        updateColors(colorIndex, eventDetail.color);
      }
    });

    // Set new colors for chart
    function setThemeValues(themeData) {
      themeInstance.data.values = themeData.values;
      themeInstance.data.widgetInstances = themeData.widgetInstances;

      var themeValue = themeInstance.data.values;
      var widgetValue = getWidgetColors(themeInstance.data.widgetInstances);

      themeValues = Object.assign(themeValue, widgetValue);

      var newColors = getColors();

      chartInstance.update({
        colors: newColors
      });
    }

    function getWidgetColors(widgets) {
      var widgetColors = {};

      if (!widgets) {
        return widgetColors;
      }

      widgets.forEach(function(widget) {
        if (widget.id === chartId) {
          Object.assign(widgetColors, widget.values);
        }
      });

      return widgetColors;
    }

    // Updates color for current device
    function updateColors(index, color) {
      var colors = getColors();

      colors[index] = color;
      chartInstance.update({
        colors: colors
      });
    }

    // Get color for current device
    function getColor(key, device) {
      if (!device) {
        return (themeValues && themeValues.hasOwnProperty(key)) && themeValues[key];
      }

      var color;

      if (themeValues && themeValues.hasOwnProperty(key + device)) {
        color = themeValues[key + device];
      } else if (device === 'Tablet') {
        color = 'inherit-mobile';
      } else {
        color = 'inherit-tablet';
      }

      if (color === 'inherit-tablet') {
        return getColor(key, 'Tablet');
      } else if (color === 'inherit-mobile') {
        return getColor(key, '');
      }

      return color;
    }

    // Generate colors for current device
    function generateColors() {
      var colors = defaultColors.slice();
      var customColors = Fliplet.Themes && Fliplet.Themes.Current.getSettingsForWidgetInstance(chartUuid);
      if (!Fliplet.Themes) {
        return colors;
      }

      colors.forEach(function(defaultColor, index) {
        var colorKey = 'chartColor' + (index + 1);
        var newColor = customColors
            ? customColors.values[colorKey]
            : Fliplet.Themes.Current.get(colorKey);

        if (newColor) {
          colors[index] = newColor;
          inheritColor1 = colorKey !== 'chartColor1';
          inheritColor2 = colorKey !== 'chartColor2';
        } else if (Fliplet.Themes.Current.get(colorKey)) {
          colors[index] = Fliplet.Themes.Current.get(colorKey);
        }

        if (colorKey === 'chartColor1' && inheritColor1) {
          colors[index] = getThemeColor('highlightColor', newColor, index, colorKey);
        } else if (colorKey === 'chartColor2' && inheritColor2) {
          colors[index] = getThemeColor('secondaryColor', newColor, index, colorKey);
        }
      });

      return colors;
    }

    // Get colors for device
    function getColors() {
      var device = deviceType ? deviceType : 'Mobile';

      deviceColors[device] = generateColors();

      return deviceColors[device];
    }

    function drawChart() {
      return new Promise(function(resolve, reject) {
        var chartColors = getColors();

        var chartOpt = {
          chart: {
            type: 'pie',
            plotBackgroundColor: null,
            plotBorderWidth: null,
            plotShadow: false,
            renderTo: $container.find('.chart-container')[0],
            style: {
              fontFamily: (Fliplet.Themes && Fliplet.Themes.Current.get('bodyFontFamily')) || 'sans-serif'
            },
            events: {
              load: function() {
                refreshChartInfo();

                if (data.autoRefresh) {
                  setRefreshTimer();
                }
              },
              render: function() {
                ui.flipletCharts[chartId] = this;
                Fliplet.Hooks.run('afterChartRender', {
                  chart: ui.flipletCharts[chartId],
                  chartOptions: chartOpt,
                  id: data.id,
                  uuid: data.uuid,
                  name: data.chartName,
                  type: 'pie',
                  config: data
                });
                resolve(this);
              }
            }
          },
          colors: chartColors,
          title: {
            text: ''
          },
          subtitle: {
            text: ''
          },
          navigation: {
            buttonOptions: {
              enabled: false
            }
          },
          tooltip: {
            headerFormat: '',
            pointFormatter: function() {
              return [
                '<strong>',
                T('widgets.charts.pie.label', { label: this.name }),
                '</strong>',
                TN(this.percentage / 100, { style: 'percent', minimumFractionDigits: 1 })
              ].join('');
            }
          },
          plotOptions: {
            pie: {
              allowPointSelect: true,
              cursor: 'pointer',
              dataLabels: {
                enabled: data.showDataValues,
                formatter: function() {
                  return [
                    (!data.showDataLegend
                      ? '<strong>' + T('widgets.charts.pie.label', { label: this.point.name }) + '</strong>'
                      : ''),
                    TN(this.point.y)
                  ].join('');
                },
                style: {
                  color: (Highcharts.theme && Highcharts.theme.contrastTextColor) || 'black'
                }
              },
              showInLegend: data.showDataLegend
            }
          },
          legend: {
            itemStyle: {
              width: '100%'
            }
          },
          series: [{
            name: data.name,
            colorByPoint: true,
            innerSize: '0%',
            data: data.entries,
            events: {
              click: function() {
                Fliplet.Analytics.trackEvent({
                  category: 'chart',
                  action: 'data_point_interact',
                  label: 'pie'
                });
              },
              legendItemClick: function() {
                Fliplet.Analytics.trackEvent({
                  category: 'chart',
                  action: 'legend_filter',
                  label: 'pie'
                });
              }
            }
          }],
          credits: {
            enabled: false
          }
        };

        // Create and save chart object
        Fliplet.Hooks.run('beforeChartRender', {
          chartOptions: chartOpt,
          id: data.id,
          uuid: data.uuid,
          name: data.chartName,
          type: 'pie',
          config: data
        }).then(function() {
          try {
            chartInstance = new Highcharts.Chart(chartOpt);
          } catch (e) {
            return Promise.reject(e);
          }
        }).catch(reject);
      });
    }

    var debouncedRedrawChart = _.debounce(function() {
      var colors = getColors();

      updateColors(colors);
    }, 100);

    $container.translate();

    $(window).on('resize', function() {
      deviceType = getDeviceType();
      debouncedRedrawChart();
    });

    if (Fliplet.Env.get('interact')) {
      $($(this).find('.chart-styles').detach().html()).appendTo('body');
    } else {
      $(this).find('.chart-styles').remove();
    }

    refreshData().then(drawChart).catch(function(error) {
      console.error(error);
      setRefreshTimer();
    });

    chartReady({
      id: data.id,
      uuid: data.uuid,
      name: data.chartName,
      type: 'pie',
      refresh: refresh
    });
  }

  Fliplet().then(function() {
    var debounceLoad = _.debounce(init, 500, { leading: true });

    Fliplet.Studio.onEvent(function(event) {
      if (event.detail.event === 'reload-widget-instance') {
        debounceLoad();
      }
    });

    init();
  });
});
