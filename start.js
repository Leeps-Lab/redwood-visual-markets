Redwood.controller("SubjectCtrl", ["$compile", "$rootScope", "$scope", "SynchronizedStopWatch", "RedwoodSubject", function($compile, $rootScope, $scope, stopwatch, rs) {

    $scope.bid = {};
    $scope.ask = {};
    $scope.accept = { qty: 0 };
    $scope.lastBidIndex = -1;
    $scope.lastAskIndex = -1;
    $scope.actionCount = 0;

    $scope.plotModel = {
        config: {},
        bidProjections: [],
        askProjections: [],
        ghostProjections: [{},{}],
        hover: false,
        allocation: false
    };
    
    $scope.onBidInputChange = function() {
        if(isValidBid($scope.bid.price, $scope.bid.qty)) {
            $scope.plotModel.hover = {
                x: $scope.allocation.x + $scope.bid.qty,
                y: $scope.allocation.y - ($scope.bid.price * $scope.bid.qty)
            };
        } else {
            $scope.plotModel.hover = false;
        }
    };

    $scope.submitBid = function() {
        if(isValidBid($scope.bid.price, $scope.bid.qty)) {
            // Self-crossing (applies in all situations)
            var askIndex = $scope.lastAskIndex, bidIndex = $scope.lastBidIndex, askKey = rs.user_id+'-'+askIndex, bidKey = rs.user_id+'-'+bidIndex;
            if (askIndex >= 0) {
                if ($scope.offers[askKey].price <= $scope.bid.price && !$scope.offers[askKey].closed) {
                    $.simplyToast('Your orders crossed and cancelled each other.', 'info');
                    $scope.plotModel.ghostProjections = [{},{}];
                    rs.trigger("cancel", {user_id: rs.user_id, index: askIndex});
                    if (bidIndex >= 0) rs.trigger("cancel", {user_id: rs.user_id, index: bidIndex});
                    $scope.lastBidIndex = -1; $scope.lastAskIndex = -1; return;
                }
            }
            $scope.bidButtonLocked = true;
            // Blended and Sequential
            var done = false, qty = Math.abs($scope.bid.qty);
            for (var i = 0; i < $scope.asks.length; i++) {
                if (!$scope.asks[i].closed && 
                    (($scope.config.convention == 'blended' && $('#state').text() == 'accept') ||
                    (($scope.config.convention == 'sequential' && $scope.bid.price >= $scope.asks[i].price)))) {
                    if (qty >= Math.abs($scope.asks[i].qty)) {
                        $scope.accept.qty = Math.abs($scope.asks[i].qty);
                        qty += $scope.asks[i].qty;
                    } else {
                        $scope.accept.qty = qty;
                        $scope.acceptOfferFromPlot($scope.asks[i]); return;
                    }
                    $scope.acceptOfferFromPlot($scope.asks[i]);
                    done = true;
                }
            }
            if (done) return;
            // Allow only one bid per person by cancelling any previous bid
            if (bidIndex >= 0) rs.trigger("cancel", {user_id: rs.user_id, index: bidIndex});
            $scope.lastBidIndex = $scope.actionCount;
            rs.trigger("offer", {user_id: rs.user_id, index: $scope.actionCount, price: $scope.bid.price, qty: $scope.bid.qty});
            $scope.actionCount++;
        } else {
            $.simplyToast('Invalid bid!', 'info');
        }
    };

    $scope.onAskInputChange = function() {
        if (isValidAsk($scope.ask.price, -$scope.ask.qty)) {
            $scope.plotModel.hover = {
                x: $scope.allocation.x - $scope.ask.qty,
                y: $scope.allocation.y + ($scope.ask.price * $scope.ask.qty)
            };
        } else {
            $scope.plotModel.hover = false;
        }
    };

    $scope.submitAsk = function() {
        if(isValidAsk($scope.ask.price, -$scope.ask.qty)) {
            // Self-crossing (applies in all situations)
            var askIndex = $scope.lastAskIndex, bidIndex = $scope.lastBidIndex, askKey = rs.user_id+'-'+askIndex, bidKey = rs.user_id+'-'+bidIndex;
            if (bidIndex >= 0) {
                if ($scope.offers[bidKey].price >= $scope.ask.price && !$scope.offers[bidKey].closed) {
                    $.simplyToast('Your orders crossed and cancelled each other.', 'info');
                    $scope.plotModel.ghostProjections = [{},{}];
                    rs.trigger("cancel", {user_id: rs.user_id, index: bidIndex});
                    if (askIndex >= 0) rs.trigger("cancel", {user_id: rs.user_id, index: askIndex});
                    $scope.lastBidIndex = -1; $scope.lastAskIndex = -1; return;
                }
            }
            // Blended and Sequential
            var done = false, qty = Math.abs($scope.ask.qty);
            var total_x = 0, total_y = 0;
            for (var i = 0; i < $scope.bids.length; i++) {
                if (!$scope.bids[i].closed && 
                    (($scope.config.convention == 'blended' && $('#state').text() == 'accept') ||
                    (($scope.config.convention == 'sequential' && $scope.ask.price <= $scope.bids[i].price)))) {
                    if (qty >= $scope.bids[i].qty) {
                        $scope.accept.qty = Math.abs($scope.bids[i].qty);
                        qty -= Math.abs($scope.bids[i].qty);
                    } else {
                        $scope.accept.qty = qty; $scope.acceptOfferFromPlot($scope.bids[i]); return;
                    }
                    $scope.acceptOfferFromPlot($scope.bids[i]);
                    done = true;
                }
            }
            if (done) return;
            // Allow only one ask per person by cancelling any previous ask
            $scope.askButtonLocked = true;
            if (askIndex >= 0) rs.trigger("cancel", {user_id: rs.user_id, index: askIndex});
            $scope.lastAskIndex = $scope.actionCount;
            rs.trigger("offer", {user_id: rs.user_id, index: $scope.actionCount, price: $scope.ask.price, qty: -$scope.ask.qty});
            $scope.actionCount++;
        } else {
            $.simplyToast('Invalid ask!', 'info');
        }
    };

    $scope.projectOffer = function(offer) {
        if(!$scope.inputsEnabled) return;
        if(offer.user_id === rs.user_id) return;
        if(offer.qty < 0 && !$scope.config.canBuy) return;
        if(offer.qty > 0 && !$scope.config.canSell) return;
        var y = $scope.allocation.y + (offer.price * offer.qty);
        var x = $scope.allocation.x - offer.qty;
        $scope.plotModel.hover = {x: x, y: y};
    };

    $scope.openOffer = function(offer) {
        if(!$scope.inputsEnabled) return;
        if(offer.qty < 0 && !$scope.config.canBuy && offer.user_id !== rs.user_id) return;
        if(offer.qty > 0 && !$scope.config.canSell && offer.user_id !== rs.user_id) return;
        if(offer.user_id != rs.user_id) {
            $scope.selectedOffer = offer;
            $scope.accept.qty = parseFloat(Math.abs(offer.qty).toFixed(2));
            $("#acceptModal").modal('show');
        }
    };
    
    $scope.cancelOffer = function(offer) {
        if(!$scope.inputsEnabled) return;
        if(offer.qty < 0 && !$scope.config.canBuy && offer.user_id !== rs.user_id) return;
        if(offer.qty > 0 && !$scope.config.canSell && offer.user_id !== rs.user_id) return;
        if(offer.user_id == rs.user_id) {
            var index = offer.qty > 0 ? $scope.lastBidIndex : $scope.lastAskIndex;
            rs.trigger("cancel", {user_id: rs.user_id, index: index});
        }
    }
    
    $scope.cancelPlotOffer = function(e) {
        var x = $('.allocation-point').offset().left,
            y = $('.allocation-point').offset().top;
        if (e.pageX > x && e.pageY > y && $scope.lastBidIndex != -1) {
            rs.trigger("cancel", {user_id: rs.user_id, index: $scope.lastBidIndex});
        } else if (e.pageX < x && e.pageY < y && $scope.lastAskIndex != -1) {
            rs.trigger("cancel", {user_id: rs.user_id, index: $scope.lastAskIndex});
        }
    }

    $scope.acceptOffer = function() {
        var offer = $scope.selectedOffer;
        if(!$scope.inputsEnabled || offer.closed) return;
        if(offer.qty < 0 && !$scope.config.canBuy) return;
        if(offer.qty > 0 && !$scope.config.canSell) return;
        var sign = offer.qty < 0 ? -1 : 1;
        // Handling various cases of invalid accepting offers
        if ($scope.accept.qty.toFixed(2) <= 0 || $scope.accept.qty > Math.abs(offer.qty)) {
            $.simplyToast("To accept for this offer, please enter a valid quantity: (0.01 to "+Math.abs(offer.qty).toFixed(2)+")", 'info');
        } else if ($scope.allocation.x.toFixed(2) - $scope.accept.qty.toFixed(2) < 0 || $scope.allocation.y.toFixed(2) < ($scope.accept.qty * offer.price).toFixed(2)) {
            $.simplyToast("Not enough asset to process transaction.", 'info');
        } else {
            $(this).attr("disabled", "disabled");
            rs.trigger("accept", {sender: rs.user_id, user_id: offer.user_id, key: offer.key, qty: sign * $scope.accept.qty});
            $("#acceptModal").modal('hide');
        }
    };
    
    $scope.acceptOfferFromPlot = function (offer) {
        if(!offer || offer.closed || offer.user_id == rs.user_id) return;
        if(offer.qty < 0 && !$scope.config.canBuy) return;
        if(offer.qty > 0 && !$scope.config.canSell) return;
        var sign = offer.qty < 0 ? -1 : 1;
        rs.trigger("accept", {sender: rs.user_id, user_id: offer.user_id, key: getOfferKey(offer), qty: sign * $scope.accept.qty});
    }
    
    $scope.$on("heatMap.click", function(e, x, y, action, offer_index) {
        $('#state').text(action);
        var qty = (x - $scope.allocation.x).toFixed(2)/1; if (Math.abs(qty) <= 0.01) return;
        var price = (($scope.allocation.y - y)/qty).toFixed(2)/1, i;
        if ($scope.config.canBid && isValidBid(price, qty)) {
            if (action == 'createOffer') {
                $scope.bid = {price: price, qty: qty};
                $scope.submitBid();
            } else if (action == 'acceptOffer') {
                for (i = 0; i < offer_index; i++) {
                    qty += $scope.asks[i].qty;
                    $scope.accept.qty = -$scope.asks[i].qty;
                    $scope.acceptOfferFromPlot($scope.asks[i]);
                }
                if (qty.toFixed(2) != 0) {
                    $scope.accept.qty = qty;
                    $scope.acceptOfferFromPlot($scope.asks[i]);
                }
            }
        } else if ($scope.config.canAsk && isValidAsk(price, qty)) {
            if (action == 'createOffer') {
                $scope.ask = {price: price, qty: -qty};
                $scope.submitAsk();
            } else if (action == 'acceptOffer') {
                for (i = 0; i < offer_index; i++) {
                    qty += $scope.bids[i].qty;
                    $scope.accept.qty = $scope.bids[i].qty;
                    $scope.acceptOfferFromPlot($scope.bids[i]);
                }
                if (qty.toFixed(2) != 0) {
                    $scope.accept.qty = -qty;
                    $scope.acceptOfferFromPlot($scope.bids[i]);
                }
            }
        }
    });

    rs.on("trade", function(info) {
        $scope.trades = rs.data.trade.reverse() || [];
        setTimeout(function () {
            var border = info.type == 'bid' ? 'red' : 'green';
            if ($scope.trades[0].sender == rs.user_id)
                $($('#trades-container > .input-group')[0]).css('border', '2px solid ' + border);
            $('#trades-container > .input-group').animate({ opacity: 1 }, 250);
            $('#actionLog').prepend('<div class="boxes">You accepted Player ' + info.offerer + "'s " + info.type + "</div>");
            $('.boxes').animate({ opacity: 1 }, 250);
        }, 50);
    });
    rs.recv("trade", function(sender, info) {
        $scope.trades = rs.data.trade.reverse() || [];
        setTimeout(function () {
            var border = info.type == 'bid' ? 'red' : 'green', offerer = "Player " + info.offerer + "'s ";
            if (info.offerer == rs.user_id) {
                offerer = "your ";
                $($('#trades-container > .input-group')[0]).css('border', '2px solid ' + border);
            }
            $('#trades-container > .input-group').animate({ opacity: 1 }, 250);
            $('#actionLog').prepend('<div class="boxes">Player ' + sender + " accepted " + offerer + info.type + "</div>");
            $('.boxes').animate({ opacity: 1 }, 250);
        }, 50);
    });
    
    function isValidBid(price, qty) {
        return !isNaN(price)
            && price >= 0
            && price * qty <= $scope.allocation.y
            && qty <= $scope.plotModel.config.xLimit
            && !isNaN(qty)
            && qty > 0;
    }

    function isValidAsk(price, qty) {
        return !isNaN(price)
            && price >= 0
            && !isNaN(qty)
            && qty < 0
            && Math.abs(qty) <= $scope.plotModel.config.xLimit - $scope.allocation.x;
    }

    rs.on_load(function() {

        processConfig();

        $scope.utilityFunction = new Function(["x", "y"], "return " + $scope.config.utility + ";");

        $scope.dotsPerLine = 80;

        $scope.Ex = $scope.config.Ex;
        $scope.Ey = $scope.config.Ey;

        $scope.showDefault = $scope.config.enableDefault && $scope.config.showDefault;

        $scope.plotModel.config.utilityFunction = $scope.utilityFunction;
        $scope.plotModel.config.dotsPerLine = $scope.dotsPerLine;
        $scope.plotModel.config.numCurves = $scope.config.numCurves;

        $scope.plotModel.config['highlightBestPrice'] = $scope.config.highlightBestPrice;
        $scope.plotModel.config['highlightInsertionPoint'] = $scope.config.highlightInsertionPoint;
        $scope.plotModel.config['showYourOffers'] = $scope.config.showYourOffers;
        $scope.plotModel.config['convention'] = $scope.config.convention;
        $scope.plotModel.config['hoverTextType'] = $scope.config.hoverTextType;
        $scope.plotModel.config['removeOnPartial'] = $scope.config.removeOnPartial;
        $scope.plotModel.config['showThermometer'] = $scope.config.showThermometer;
        $scope.plotModel.config['disableHeatmapClicks'] = $scope.config.disableHeatmapClicks;
		$scope.plotModel.config['showFrontier'] = $scope.config.showFrontier;
        $scope.plotModel.config['Ex'] = $scope.Ex;
        $scope.plotModel.config['Ey'] = $scope.Ey;
        $scope.plotModel.config['colorBound'] = $scope.config.colorBound;
        
        $scope.rounds = $scope.config.rounds || 1;
        $scope.round = 0;
        if (!$scope.config.showOrderBook) { $('.col-lg-6:first').remove(); }
        rs.trigger("next_round");
        
    });

    var checkTime = function() {
        $scope.timeRemaining = 0;
        $scope.stopwatch = stopwatch.instance()
            .frequency(1)
            .duration($scope.config.roundDuration)
            .onTick(function(tick, t) {
                $scope.timeRemaining = $scope.timeTotal - t;
            })
            .onComplete(function() {
                $scope.timeRemaining = 0;
                $scope.inputsEnabled = false;
                $scope.roundStartTime = null;
                rs.trigger("next_round");
            }).start();
        $scope.timeTotal = $scope.stopwatch.getDurationInTicks()
    };

    rs.recv("next_round", function(sender, time) {
        if($scope.roundStartTime) {
            $scope.inputsEnabled = false;
            $scope.roundStartTime = null;
            rs.trigger("next_round");
        }
    });


    rs.on("next_round", function(time) {

        $scope.inputsEnabled = false;

        if($scope.rounds && $scope.round >= $scope.rounds) {
            rs.trigger("next_period");
            return;
        }

        //Begin next round
        $scope.round++;
        rs.synchronizationBarrier('round-' + $scope.round).then(function() {

            $scope.allocation = {x: $scope.Ex, y: $scope.Ey};
            
            $scope.plotModel.config.xLimit = $scope.config.XLimit;
            $scope.plotModel.config.yLimit = $scope.config.YLimit;
            $scope.$broadcast("plot.activate");

            $scope.offers = {};

            $scope.roundStartTime = (new Date()).getTime() / 1000;
            rs.trigger("roundStartTime", $scope.roundStartTime);
            //rs.timeout(checkTime);
            checkTime();

            $scope.inputsEnabled = true;
        });
    });

    rs.on("roundStartTime", function(roundStartTime) {
        $scope.roundStartTime = Math.min(roundStartTime, $scope.roundStartTime);
    });
    rs.recv("roundStartTime", function(sender, roundStartTime) {
        $scope.roundStartTime = Math.min(roundStartTime, $scope.roundStartTime);
    });

    rs.on("allocation", function(allocation) {
        $scope.allocation = allocation;
    });

    rs.on("offer", function(offer) {
        var type = offer.qty > 0 ? 'a bid' : 'an ask';
        offer = $.extend(offer, {user_id: rs.user_id});
        var key = getOfferKey(offer);
        $scope.offers[key] = $.extend(offer, {key: key});
        $scope.bidButtonLocked = false;
        $scope.askButtonLocked = false;
        $('#actionLog').prepend('<div class="boxes">You placed '+type+"</div>");
        $('.boxes').animate({ opacity: 1 }, 250);
    });

    rs.recv("offer", function(user_id, offer) {
        var type = offer.qty > 0 ? 'a bid' : 'an ask';
        offer = $.extend(offer, {user_id: user_id});
        var key = getOfferKey(offer);
        $scope.offers[key] = $.extend(offer, {key: key});
        $('#actionLog').prepend('<div class="boxes">Player ' + user_id + " placed " + type + "</div>");
        $('.boxes').animate({ opacity: 1 }, 250);
    });
    
    rs.on("cancel", function(offer) {
        var type = offer.qty > 0 ? 'bid' : 'ask';
        offer = $.extend(offer, {user_id: rs.user_id});
        var key = getOfferKey(offer);
        $scope.offers[key].closed = true;
        $('#actionLog').prepend('<div class="boxes">You cancelled your ' + type + "</div>");
        $('.boxes').animate({ opacity: 1 }, 250);
    });
    
    rs.recv("cancel", function(user_id, offer) {
        var type = offer.qty > 0 ? 'bid' : 'ask';
        offer = $.extend(offer, {user_id: user_id});
        var key = getOfferKey(offer);
        $scope.offers[key].closed = true;
        $('#actionLog').prepend('<div class="boxes">Player ' + user_id + " cancelled a " + type + "</div>");
        $('.boxes').animate({ opacity: 1 }, 250);
    });

    rs.on("accept", function(accepted) {
        var offer = $scope.offers[accepted.key], type = offer.qty > 0 ? 'bid' : 'ask';
        $scope.allocation.y += offer.price * accepted.qty;
        $scope.allocation.x -= accepted.qty;
        offer.qty -= accepted.qty;
        $scope.bidButtonLocked = false;
        $scope.askButtonLocked = false;
        if (Math.abs(offer.qty).toFixed(2) <= 0.01) offer.closed = true;
        else if ($scope.plotModel.config.removeOnPartial == true) offer.closed = true;
        rs.trigger("trade", angular.extend(accepted, {qty: Math.abs(accepted.qty), price: offer.price, type: type, offerer: accepted.user_id}));
        if ($scope.lastBidIndex >= 0 && $scope.bid.qty > $scope.allocation.y) {
            $.simplyToast("Your bid is no longer valid!", 'info');
            rs.trigger("cancel", {user_id: rs.user_id, index: $scope.lastBidIndex});
        }
        if ($scope.lastAskIndex >= 0 && $scope.ask.qty > $scope.allocation.x) {
            $.simplyToast("Your ask is no longer valid!", 'info');
            rs.trigger("cancel", {user_id: rs.user_id, index: $scope.lastAskIndex});
        }
    });

    rs.recv("accept", function(sender, accepted) {
        var offer = $scope.offers[accepted.key];
        offer.qty -= accepted.qty;
        if (accepted.user_id == rs.user_id) {
            $scope.allocation.y -= offer.price * accepted.qty;
            $scope.allocation.x += accepted.qty;
        }
        if (Math.abs(offer.qty).toFixed(2) <= 0.01) offer.closed = true;
        else if ($scope.plotModel.config.removeOnPartial == true) offer.closed = true;
    });

    rs.on("result", function(value) {
        if(!$scope.results) {
            $scope.results = [];
        }
        $scope.results.push(value);
    });

    rs.on("next_period", function() {
        var finalResult = {x: $scope.allocation.x, y: $scope.allocation.y, utility: $scope.utilityFunction($scope.allocation.x, $scope.allocation.y)};
        finalResult.period = rs.period;
        rs.set("results", finalResult);
        rs.add_points($scope.utilityFunction($scope.allocation.x, $scope.allocation.y));
        rs.next_period();
    });

    var processConfig = function() {
        var userIndex = parseInt(rs.user_id) - 1;
        var XLimit = 0, YLimit = 0;
        $scope.config = {};

        $scope.config.Ex = $.isArray(rs.config.Ex) ? rs.config.Ex[userIndex] : rs.config.Ex;
        $scope.config.Ey = $.isArray(rs.config.Ey) ? rs.config.Ey[userIndex] : rs.config.Ey;
        $scope.config.utility = $.isArray(rs.config.utility) ? rs.config.utility[userIndex] : rs.config.utility;
        $scope.config.canBid = $.isArray(rs.config.canBid) ? rs.config.canBid[userIndex] : rs.config.canBid;
        $scope.config.canAsk = $.isArray(rs.config.canAsk) ? rs.config.canAsk[userIndex] : rs.config.canAsk;
        $scope.config.canBuy = $.isArray(rs.config.canBuy) ? rs.config.canBuy[userIndex] : rs.config.canBuy;
        $scope.config.canSell = $.isArray(rs.config.canSell) ? rs.config.canSell[userIndex] : rs.config.canSell;
        
        for (var i = 0; i < rs.subjects.length; i++) {
            if ($.isArray(rs.config.Ex)) XLimit += rs.config.Ex[rs.config.groups[rs._group-1][0]+i-1];
            else XLimit += rs.config.Ex;
            if ($.isArray(rs.config.Ey)) YLimit += rs.config.Ey[rs.config.groups[rs._group-1][0]+i-1];
            else YLimit += rs.config.Ey;
        }
        $scope.config.XLimit = XLimit;
        $scope.config.YLimit = YLimit;
        $scope.config.showHeatmap = $.isArray(rs.config.showHeatmap) ? rs.config.showHeatmap[userIndex] : rs.config.showHeatmap;
        $scope.config.showThermometer = $.isArray(rs.config.showThermometer) ? rs.config.showThermometer[userIndex] : rs.config.showThermometer;
        $scope.config.showOrderBook = $.isArray(rs.config.showOrderBook) ? rs.config.showOrderBook[userIndex] : rs.config.showOrderBook;
        $scope.config.numCurves = $.isArray(rs.config.numCurves) ? rs.config.numCurves[userIndex] : rs.config.numCurves;
        $scope.config.highlightBestPrice = $.isArray(rs.config.highlightBestPrice) ? rs.config.highlightBestPrice[userIndex] : rs.config.highlightBestPrice;
        $scope.config.highlightInsertionPoint = $.isArray(rs.config.highlightInsertionPoint) ? rs.config.highlightInsertionPoint[userIndex] : rs.config.highlightInsertionPoint;
        $scope.config.showYourOffers = $.isArray(rs.config.showYourOffers) ? rs.config.showYourOffers[userIndex] : rs.config.showYourOffers;
        $scope.config.convention = $.isArray(rs.config.convention) ? rs.config.convention[userIndex] : rs.config.convention;
        $scope.config.hoverTextType = $.isArray(rs.config.hoverTextType) ? rs.config.hoverTextType[userIndex] : rs.config.hoverTextType;
        $scope.config.removeOnPartial = $.isArray(rs.config.removeOnPartial) ? rs.config.removeOnPartial[userIndex] : rs.config.removeOnPartial;
        $scope.config.showThermometer = $.isArray(rs.config.showThermometer) ? rs.config.showThermometer[userIndex] : rs.config.showThermometer;
        $scope.config.disableHeatmapClicks = $.isArray(rs.config.disableHeatmapClicks) ? rs.config.disableHeatmapClicks[userIndex] : rs.config.disableHeatmapClicks;
		$scope.config.showFrontier = $.isArray(rs.config.showFrontier) ? rs.config.showFrontier[userIndex] : rs.config.showFrontier;
        $scope.config.colorBound = rs.config.colorBound;
        
        $scope.config.rounds =  rs.config.rounds;
        $scope.config.roundDuration =  rs.config.roundDuration;

        $scope.config.pause = rs.config.pause;
    };

    function getOfferKey(offer) {
        return offer.user_id + "-" + offer.index;
    }

    $scope.$watch("offers", function(offers) {
        if(!offers) return;
        $scope.bids = Object.keys(offers)
            .filter(function(d) {
                return offers[d].qty > 0 && !offers[d].closed;
            })
            .sort(function(a, b) {
                return offers[b].price - offers[a].price;
            })
            .map(function(d) {
                return offers[d];
            });


        $scope.asks = Object.keys(offers)
            .filter(function(d) {
                return offers[d].qty < 0 && !offers[d].closed;
            })
            .sort(function(a, b) {
                return offers[a].price - offers[b].price;
            })
            .map(function(d) {
                return offers[d];
            });

        if($scope.config.canSell) {
            var x = $scope.allocation.x;
            var y = $scope.allocation.y;
            $scope.plotModel.bidProjections = $scope.bids
                .filter(function(bid) {
                    return bid.user_id != rs.user_id;
                })
                .map(function(bid) {
                    x -= bid.qty;
                    y += (bid.price * bid.qty);
                    return {
                        x: x,
                        y: y
                    };
                });
            x = $scope.allocation.x;
            y = $scope.allocation.y;
            $scope.plotModel.ghostProjections[0] = $scope.bids
                .filter(function(bid) {
                    return bid.user_id == rs.user_id;
                })
                .map(function(bid) {
                    x -= bid.qty;
                    y += (bid.price * bid.qty);
                    return {
                        x: x,
                        y: y
                    };
                });
            
        }

        if($scope.config.canBuy) {
            var x = $scope.allocation.x;
            var y = $scope.allocation.y;
            $scope.plotModel.askProjections = $scope.asks
                .filter(function(ask) {
                    return ask.user_id != rs.user_id;
                })
                .map(function(ask) {
                    x -= ask.qty;
                    y += (ask.price * ask.qty);
                    return {
                        x: x,
                        y: y
                    };
                });
            x = $scope.allocation.x;
            y = $scope.allocation.y;
            $scope.plotModel.ghostProjections[1] = $scope.asks
                .filter(function(ask) {
                    return ask.user_id == rs.user_id;
                })
                .map(function(ask) {
                    x -= ask.qty;
                    y += (ask.price * ask.qty);
                    return {
                        x: x,
                        y: y
                    };
                });
        }
        
        setTimeout(function() {
            $('#asks-container > .input-group').each(function (index) {
                $(this).css('border-radius', '5px');
                $($(this).children()).css('background', '');
                if ($(this).attr('key').split('-')[0] == rs.user_id) {
                    if (index == 0) $($(this).children()).css('background', 'yellow');
                    $(this).css('border', '2px solid green');
                }
                $(this).animate({ opacity: 1 }, 250);
            });
            $('#bids-container > .input-group').each(function (index) {
                $(this).css('border-radius', '5px');
                $($(this).children()).css('background', '');
                if ($(this).attr('key').split('-')[0] == rs.user_id) {
                    if (index == 0) $($(this).children()).css('background', 'yellow');
                    $(this).css('border', '2px solid red');
                }
                $(this).animate({ opacity: 1 }, 250);
            });
        }, 180);
        
    }, true /*Deep watch*/);

    $scope.$watch("allocation", function(allocation) {
        $scope.plotModel.allocation = allocation;
    }, true);

}]);

Redwood.directive('ngRightClick', function($parse) {
    return function(scope, element, attrs) {
        var fn = $parse(attrs.ngRightClick);
        element.bind('contextmenu', function(event) {
            scope.$apply(function() {
                event.preventDefault();
                fn(scope, {$event:event});
            });
        });
    };
});

Redwood.directive("svgPlot", ['$timeout', 'AsyncCallManager', function($timeout, AsyncCallManager) {
    return {
        restrict: 'E',
        replace: true,
        scope: {
            config: '=',
            bidProjections: '=',
            askProjections: '=',
            ghostProjections: '=',
            allocation: '=',
            hover: '='
        },
        template: "<svg version='1.1'></svg>",
        link: function($scope, element, attrs) {

            var utilityGrid,
                scales = {},
                referenceValues,
                mouseDown,
                dragging = false,
                insertionIndex;

            var xMin, xMax, yMin, yMax, currentScale = 1;

            var svgWidth = 625;
            var svgHeight = svgWidth;

            $(element[0]).height(svgHeight);
            $(element[0]).width(svgWidth);

            var svg = d3.select(element[0]);

            var plotMargin = { top: 10, right: 10, bottom: 40, left: 40 };

            var plotWidth = svgWidth - plotMargin.left - plotMargin.right;
            var plotHeight = svgHeight - plotMargin.bottom - plotMargin.top;

            svg.append("defs").append("clipPath")
                .attr("id", "plotAreaClip")
                .append("rect")
                .attr("x", "0")
                .attr("y", "0")
                .attr("width", plotWidth)
                .attr("height", plotHeight)
            $('#thermometer')
                .attr('width', plotWidth+20)
                .attr('height', 30)
                .css('margin-left', plotMargin.left);
            $('#heatmapRender')
                .attr('width', plotWidth)
                .attr('height', plotHeight)
                .css('margin-left', plotMargin.left)
                .css('margin-top', plotMargin.top);

            var plot = svg.append("g")
                .attr("transform", "translate(" + plotMargin.left + "," + plotMargin.top + ")")
                .attr("clip-path", "url(#plotAreaClip)");

            var baseLayer = plot.append("g")
                .style("cursor", "pointer");

            var heatMapContainer = baseLayer.append("g");

            var xAxisContainer = svg.append("g")
                .attr("class", "axis")
                .attr("transform", "translate(" + (plotMargin.left) + ", " + (plotMargin.top + plotHeight) + ")");
            var xAxis = d3.svg.axis()
                .outerTickSize(5);

            var yAxisContainer = svg.append("g")
                .attr("class", "axis")
                .attr("transform", "translate(" + plotMargin.left + ", " + plotMargin.top + ")");
            var yAxis = d3.svg.axis()
                .orient("left")
                .outerTickSize(5);

            svg.append("text")
                .attr("class", "axis label")
                .attr("x", (plotWidth / 2) + plotMargin.left)
                .attr("y", svgHeight - 5)
                .text("[ X ]");

            svg.append("text")
                .attr("class", "axis label")
                .attr("transform", "rotate(-90)")
                .attr("y", 10)
                .attr("x", -((plotHeight / 2) + plotMargin.top))
                .text("[ Y ]");

            var bidProjectionContainer = baseLayer.append("g")
                .attr("class", "bid-projection-container");
            var askProjectionContainer = baseLayer.append("g")
                .attr("class", "ask-projection-container");
            var ghostProjectionContainer = baseLayer.append("g")
                .attr("class", "ghost-projection-container");

            var allocationContainer = baseLayer.append("g")
                .attr("class", "allocation-container");
            var allocationText = allocationContainer.append("text")
                .attr("class", "allocation-text");
            var allocationPoint = allocationContainer.append("circle")
                .attr("class", "allocation-point")
                .attr("r", 5);
            var allocationAreaA = allocationContainer.append("rect")
                .attr("class", "allocation-area")
                .attr("opacity", 0.2);
            var allocationAreaB = allocationContainer.append("rect")
                .attr("class", "allocation-area")
                .attr("opacity", 0.2);
            var allocationCurve = d3.rw.indifferenceCurve();

            var hoverContainer = baseLayer.append("g")
                .attr("class", "hover-container");
            var hoverText = hoverContainer.append("text")
                .attr("class", "hover-text");
            var hoverPoint = hoverContainer.append("circle")
                .attr("class", "hover-point")
                .attr("r", 5);
            var hoverCurve = d3.rw.indifferenceCurve();
            $("#plot").on("contextmenu", function () { return false; });

// START TEST

// BLENDED

/* var  changingPlayer = [
    [60,50], // case a
    [72,40], // case b
    [54,55], // case c
    [-18,15], // case d
    [-24,20]], // case e
    testCase = 1, actionIndex = 0;
    
// Update new event
setInterval(function () {
    if (!$scope.allocation || actionIndex > 3) return;
    var point;
    switch (document.URL.split('subject/')[1]) {
        case "1": if (actionIndex == 0) point = validAreaHovered({x:50,y:80}); break;
        case "2": if (actionIndex == 3) point = validAreaHovered({ x: changingPlayer[testCase][0], y: changingPlayer[testCase][1] }); break;
        case "3": if (actionIndex == 1) point = validAreaHovered({x:70,y:30}); break;
        case "4": if (actionIndex == 2) point = validAreaHovered({x:60,y:30}); break;
    }
    actionIndex++;
    if (!point) return;
    // Normal sequence
    var area = point.area;
    if ($scope.config.disableHeatmapClicks) return;
    if (point.area != 'invalidArea' && (point.x < 0 || point.y < 0)) area = 'invalidArea';
    if (area == 'createOffer') {
        $scope.$emit("heatMap.click", point.x, point.y, 'createOffer', point.index);
        drawGhostProjection($scope.ghostProjections);
    } else if (area != 'invalidArea') $scope.$emit("heatMap.click", point.x, point.y, 'acceptOffer', point.index);
}, 1000); */

// END TEST
            
            plot.on("click", function(e) {
                var point = validAreaHovered($scope.hover), area = point.area;
                if (point.area != 'invalidArea' && (point.x < 0 || point.y < 0)) area = 'invalidArea';
                if ($scope.config.disableHeatmapClicks) return;
                if (area == 'createOffer') {
                    $scope.$emit("heatMap.click", point.x, point.y, 'createOffer', point.index);
                    drawGhostProjection($scope.ghostProjections);
                } else if (area != 'invalidArea') $scope.$emit("heatMap.click", point.x, point.y, 'acceptOffer', point.index);
            });

            plot.on("mousedown", function() {
                var position = d3.mouse(this);
                $scope.$apply(function() {
                    mouseDown = {x: scales.offsetToX(position[0]), y: scales.offsetToY(position[1])};
                });
            });
            plot.on("mouseup", function() {
                $scope.$apply(function() {
                    mouseDown = false;
                    if(dragging) {
                        dragging = false;
                        onMove();
                    }
                });
            });

            var from, to;
            plot.on("mousemove", function() {
                var position = d3.mouse(this);
                $scope.$apply(function() {

                    var values = {x: scales.offsetToX(position[0]) / currentScale, y: scales.offsetToY(position[1]) / currentScale};

                    if (mouseDown) {
                        dragging = true;
                        from = angular.copy(mouseDown);
                        to = angular.copy(values);
                        onDrag();
                    } else {
                        $scope.hover = {x: values.x, y: values.y};
                        redrawHoverCurve($scope.hover);
                    }
                });
            });

            plot.on("mouseleave", function() {
                $scope.$apply(function() {
                    mouseDown = false;
                    if(dragging) {
                        dragging = false;
                        to = from;
                        onDrag();
                    }
                    $scope.hover = false;
                });
            });

            var zoomed = true;
            var zoom = d3.behavior.zoom()
                .on("zoom", function() {
                    var position = d3.mouse(this);
                    var x = scales.offsetToX(position[0]);
                    var y = scales.offsetToY(position[1]);
                    currentScale = d3.event.scale;
                    onZoom(x, y);
                    zoomed = false;
                    setTimeout(function() {
                        if (zoomed == false) {
                            redrawHeatMap();
                            zoomed = true;
                        }
                    }, 250);
                });
            plot.call(zoom);

            $scope.$on("plot.activate", function() {
                $scope.$watch("config", redrawAll, true);
                $scope.$watch("ghostProjections", function(projections) {
                    drawGhostProjection(projections);
                }, true);
                $scope.$watch("bidProjections", function(projections) {
                    redrawProjections(projections, "bid");
                }, true);
                $scope.$watch("askProjections", function(projections) {
                    redrawProjections(projections, "ask");
                }, true);
                $scope.$watch("allocation", function(allocation) {
                    redrawAllocation(allocation);
                    redrawProjections($scope.bidProjections, "bid");
                    redrawProjections($scope.askProjections, "ask");
                }, true);
               $scope.$watch("hover", redrawHoverCurve, true);
               initialize();
            });

            function generateScales() {
                scales.indexToX = d3.scale.linear().domain([0, $scope.config.dotsPerLine - 1]).range([xMin, xMax]);
                scales.indexToY = d3.scale.linear().domain([0, $scope.config.dotsPerLine - 1]).range([yMin, yMax]);
                scales.xToOffset = d3.scale.linear().domain([xMin, xMax]).range([0, plotWidth]).clamp(false);
                scales.yToOffset = d3.scale.linear().domain([yMin, yMax]).range([plotHeight, 0]).clamp(false);
                scales.xIndexToOffset = function(d) { return scales.xToOffset(scales.indexToX(d)); };
                scales.yIndexToOffset = function(d) { return scales.yToOffset(scales.indexToY(d)); };
                scales.offsetToX = d3.scale.linear().domain([0, plotWidth]).range([xMin, xMax]).clamp(true);
                scales.offsetToY = d3.scale.linear().domain([plotHeight, 0]).range([yMin, yMax]).clamp(true);
            }

            function onDrag() {
                onMove();
            }

            var onMove = AsyncCallManager.mergeOverlappingCallsTo(function() {

                return $timeout(function() {
                    var xDiff = to.x * currentScale - from.x;
                    var xRange = xMax - xMin;
                    xMin = Math.max(Math.min($scope.config.xLimit, xMin - xDiff), 0);
                    xMax = xMin + xRange;
                    if(xMax > $scope.config.xLimit) {
                        xMax = $scope.config.xLimit;
                        xMin = xMax - xRange;
                    }

                    var yDiff = to.y * currentScale - from.y;
                    var yRange = yMax - yMin;
                    yMin = Math.max(Math.min($scope.config.yLimit, yMin - yDiff), 0);
                    yMax = yMin + yRange;
                    if(yMax > $scope.config.yLimit) {
                        yMax = $scope.config.yLimit;
                        yMin = yMax - yRange;
                    }

                    generateScales();

                    baseLayer.attr("transform", "translate(" + "0" + "," + "0" + ")");
                    redrawAll($scope.config);
                });
            });

            function onZoom(x, y) {
                var scale = 1 / d3.event.scale;
                if(scale > 1) {
                    zoom.scale(1);
                    scale = 1;
                }
                if(d3.event.scale > 10000) {
                    zoom.scale(10000);
                    scale = 1 / d3.event.scale;
                }

                var xRange = $scope.config.xLimit * scale;
                var xFactor = (x - xMin) / (xMax - xMin);
                xMin = Math.max(x - (xRange * xFactor), 0);
                xMax = xMin + xRange;
                if(xMax > $scope.config.xLimit) {
                    xMax = $scope.config.xLimit;
                    xMin = xMax - xRange;
                }

                var yRange = $scope.config.yLimit * scale;
                var yFactor = (y - yMin) / (yMax - yMin);
                yMin = Math.max(y - (yRange * yFactor), 0);
                yMax = yMin + yRange;
                if(yMax > $scope.config.yLimit) {
                    yMax = $scope.config.yLimit;
                    yMin = yMax - yRange;
                }

                generateScales();

                redrawAll($scope.config);
            }
            
           function sortNumber(a,b) {
                return a - b;
            }

            function initialize() {

                xMin = 0;
                xMax = $scope.config.xLimit;
                yMin = 0;
                yMax = $scope.config.yLimit;

                generateScales();

                utilityGrid = d3.rw.functionGrid($scope.config.utilityFunction, scales.indexToX, scales.indexToY);

                var minUtility = d3.min(utilityGrid, function(col) {
                    return d3.min(col);
                });
                var maxUtility = d3.max(utilityGrid, function(col) {
                    return d3.max(col);
                });

                var initialUtility = $scope.config.utilityFunction($scope.config.Ex, $scope.config.Ey),
                    colorRange = ["#0000ff", "#00fff0", "#ffff00", "#ff0000"],
                    utilRange = maxUtility - minUtility, stretch,
                    bound = $scope.config.colorBound;
                if (bound) {
                    if (bound[0] == 0) stretch = [initialUtility, initialUtility+bound[1]*utilRange];
                    else if (bound[1] == 0) stretch = [initialUtility+bound[0]*utilRange, initialUtility];
                    else stretch = [initialUtility+bound[0]*utilRange, initialUtility+bound[1]*utilRange];
                } else stretch = [minUtility, maxUtility];
                var colorDomain = d3.rw.stretch(stretch.sort(sortNumber), colorRange.length);
                scales.colorScale = d3.scale.linear().domain(colorDomain).range(colorRange);
                referenceValues = [];
                referenceValues.push($scope.config.utilityFunction($scope.config.Ex, $scope.config.Ey));
                for(var i = 0; i < $scope.config.numCurves; i++) {
                    referenceValues.push($scope.config.utilityFunction(((i + 1) * (xMax - xMin) / ($scope.config.numCurves + 1)) + xMin, ((i + 1) * (yMax - yMin) / ($scope.config.numCurves + 1)) + yMin));
                }
                redrawHeatMap();
                if ($scope.config.showThermometer) redrawThermometer();
                else $('#thermometerDisplay').hide();
            }
            
            function redrawThermometer () {
                var c = $('#thermometer')[0];
                if (!c) return;
                var ctx = c.getContext("2d");
                var grd = ctx.createLinearGradient(10,0,c.width-20,0);
                utilityGrid = d3.rw.functionGrid($scope.config.utilityFunction, scales.indexToX, scales.indexToY);
                var minUtility = d3.min(utilityGrid, function(col) { return d3.min(col); });
                var maxUtility = d3.max(utilityGrid, function(col) { return d3.max(col); });
                var initialUtility = $scope.config.utilityFunction($scope.config.Ex, $scope.config.Ey),
                    colorRange = ["#0000ff", "#00fff0", "#ffff00", "#ff0000"],
                    utilRange = maxUtility - minUtility, stretch,
                    bound = $scope.config.colorBound;
                if (bound) {
                    if (bound[0] == 0) stretch = [initialUtility, initialUtility+bound[1]*utilRange];
                    else if (bound[1] == 0) stretch = [initialUtility+bound[0]*utilRange, initialUtility];
                    else stretch = [initialUtility+bound[0]*utilRange, initialUtility+bound[1]*utilRange];
                } else stretch = [minUtility, maxUtility];
                var colorDomain = d3.rw.stretch(stretch.sort(sortNumber), colorRange.length);
                for (var i = 0; i < colorRange.length; i++) {
                    var point = colorDomain[i]/(maxUtility - minUtility);
                    if (point > 1) point = 1;
                    grd.addColorStop(point, colorRange[i]); 
                }
                ctx.clearRect(0,0,c.width,c.height);
                ctx.fillStyle = grd;
                ctx.fillRect(10,0,c.width-20,c.height/2);
                ctx.strokeStyle = 'black';
                ctx.lineWidth = 0.5;
                ctx.fillStyle = 'black';
                for (var i = 0; i < 11; i++) {
                    ctx.beginPath();
                    ctx.moveTo(11+i*(c.width-22)/10, c.height/2);
                    ctx.lineTo(11+i*(c.width-22)/10, 2.5*c.height/4);
                    var text = (i*(maxUtility-minUtility)/10).toFixed(1);
                    ctx.fillText(text, 11+(i*(c.width-22)/10)-ctx.measureText(text).width/2, c.height);
                    ctx.stroke();
                }
            }

            function redrawAll(config) {
                if(!config) {
                    return;
                }

                xAxis.scale(scales.xToOffset);
                xAxisContainer.call(xAxis);

                yAxis.scale(scales.yToOffset);
                yAxisContainer.call(yAxis);

                utilityGrid = d3.rw.functionGrid(config.utilityFunction, scales.indexToX, scales.indexToY);

                redrawProjections($scope.bidProjections, "bid");
                redrawProjections($scope.askProjections, "ask");

                allocationCurve.grid(utilityGrid)
                    .xScale(scales.xIndexToOffset)
                    .yScale(scales.yIndexToOffset);
                redrawAllocation($scope.allocation);

                hoverCurve.grid(utilityGrid)
                    .xScale(scales.xIndexToOffset)
                    .yScale(scales.yIndexToOffset);
                redrawHoverCurve($scope.hover);
            } 
            
            function redrawAllocation(allocation) {
                if(!$scope.config) {
                    return;
                }

                if(!allocation) {
                    allocationContainer.attr("visibility", "hidden");
                }

                var utility = $scope.config.utilityFunction(allocation.x, allocation.y);
                var x = scales.xToOffset(allocation.x), y = scales.yToOffset(allocation.y);

                allocationText
                    .attr("x", x + 10)
                    .attr("y", y - 10);

                allocationPoint.attr("cx", x).attr("cy", y);
                allocationAreaA.attr("x", x).attr("y", 0).attr("width", plotWidth - x).attr("height", y);
                allocationAreaB.attr("x", 0).attr("y", y).attr("width", x).attr("height", plotHeight - y);

                allocationContainer.call(allocationCurve.value(utility));

                allocationContainer.attr("visibility", "visible");
            }
            
            function redrawHeatMap() {
                var heatMap = d3.rw.heatMap()
                    .grid(utilityGrid)
                    .xScale(scales.xIndexToOffset)
                    .yScale(scales.yIndexToOffset)
                    .colorScale(scales.colorScale);
                heatMapContainer.call(heatMap);
                
                var referenceCurves = baseLayer.selectAll(".reference-curve").data(referenceValues);
                referenceCurves.enter()
                    .append("g")
                    .attr("class", "reference-curve")
                    .style("opacity", "0.6");
                referenceCurves.each(function(value) {
                    d3.select(this).call(d3.rw.indifferenceCurve()
                            .grid(utilityGrid)
                            .xScale(scales.xIndexToOffset)
                            .yScale(scales.yIndexToOffset)
                            .value(value)
                    );
                });
            }

            function redrawProjections(projections, type) {

				if (!$scope.config.showFrontier) return;
			
                var container = type === "bid" ? bidProjectionContainer : askProjectionContainer;
                var color = type === "bid" ? "red" : "green";
                var points = container.selectAll('.projection-point').data(projections || []);

                points.enter()
                    .append("circle")
                    .attr("class", "projection-point")
                    .attr("r", 5)
                    .attr("fill", color)
                    .attr('stroke', 'black');

                points
                    .attr("cx", function(projection) {
                        return scales.xToOffset(projection.x);
                    })
                    .attr("cy", function(projection) {
                        return scales.yToOffset(projection.y);
                    });
                    
                points.exit().remove();
                    
                var connectors = container.selectAll('.projection-connector').data(projections || []);

                var previous = [scales.xToOffset($scope.allocation.x), scales.yToOffset($scope.allocation.y)];
                connectors.enter()
                    .append("g")
                    .attr("class", "projection-connector");
                connectors
                    .each(function(projection) {
                        d3.select(this).selectAll('*').remove();
                        var current = [scales.xToOffset(projection.x), scales.yToOffset(projection.y)];
                        d3.select(this).append("path").data([[angular.copy(previous), current]])
                            .style("fill", "none")
                            .style("stroke", color)
                            .style("stroke-width", "2")
                            .attr("d", d3.svg.line());
                        previous = current;
                    });
                connectors.exit().remove();
                
                drawGhostProjection($scope.ghostProjections);
            }
            
            function drawGhostProjection (projection) {
                if (!$scope.config.showYourOffers) return;
                $('.ghost-projection-point').remove(); $('.ghost-projection-connector').remove();
                var points = ghostProjectionContainer.selectAll('.ghost-projection-point').data(projection || []);
                for (var i = 0; projection[i]; i++) {
                    if (projection[i].length == 0) continue;
                    var alloc = {x: scales.xToOffset($scope.allocation.x), y: scales.yToOffset($scope.allocation.y)};
                    var ghost = {x: 2*alloc.x-scales.xToOffset(projection[i][0].x), y: 2*alloc.y-scales.yToOffset(projection[i][0].y)};
                    var color = 'grey', ghost_slope = (alloc.y-ghost.y)/(alloc.x-ghost.x), ask = $scope.askProjections[0], bid = $scope.bidProjections[0];
                    if (i == 0) {
                        if (!bid) color = 'yellow';
                        else if (ghost_slope > (alloc.y-scales.yToOffset(bid.y))/(alloc.x-scales.xToOffset(bid.x))) color = 'yellow';
                    } else if (i == 1) {
                        if (!ask) color = 'yellow';
                        else if (ghost_slope < (alloc.y-scales.yToOffset(ask.y))/(alloc.x-scales.xToOffset(ask.x))) color = 'yellow';
                    }
                    points.enter()
                    .append("circle")
                        .attr("class", "ghost-projection-point")
                        .attr("r", 5)
                        .attr("fill", color)
                        .attr("cx", ghost.x)
                        .attr("cy", ghost.y);
                    ghostProjectionContainer.append("line")
                        .attr("class", "ghost-projection-connector")
                        .attr("x1", alloc.x)
                        .attr("y1", alloc.y)
                        .attr("x2", ghost.x)
                        .attr("y2", ghost.y)
                        .attr("stroke-width", 2)
                        .attr("stroke", color);
                }
                points.exit().remove();
                ghostProjectionContainer.attr("visibility", "visible");
            }

            function redrawHoverCurve(hover) {
                if(!$scope.config) {
                    return;
                }

                if(!hover) {
                    hoverContainer.attr("visibility", "hidden");
                } else {
                    var point = validAreaHovered($scope.hover), area = point.area;
                    var area = point.area;
                    if (point.area != 'invalidArea' && (point.x < 0 || point.y < 0)) area = 'invalidArea';
                    if (point.x) hover = point;
                    var alloc = $scope.allocation
                    var xOffset = scales.xToOffset(hover.x);
                    var yOffset = scales.yToOffset(hover.y);
                    var utility = $scope.config.utilityFunction(hover.x, hover.y), price = Math.abs(getPrice(hover,alloc));
                    var xHoverOffset = 10, yHoverOffset = -10, color = "grey";
                    var acceptingOffer = false;
                    var displayText = "";
                    if ($scope.config.hoverTextType == 'utility') displayText = " £=["+utility.toFixed(1)+"]";
                    else if ($scope.config.hoverTextType == 'price') displayText = " P=["+price.toFixed(1)+"]";
                    else if ($scope.config.hoverTextType == 'both') displayText = " P=["+price.toFixed(1)+"]"+" £=["+utility.toFixed(1)+"]";
					if (!$scope.config.showFrontier) {
						color = "grey";
						hoverText.text(displayText);
					} else {
						switch (area) {
							case 'invalidArea': hoverText.text("not a trade"); break;
							case 'createOffer':
								if ($scope.config.highlightBestPrice && point.isBest) color = 'yellow';
								hoverText.text("Create Offer"+displayText);
								break;
							default:
								hoverText.text("Accept Offer"+displayText);
								acceptingOffer = true;
								break;
						}
					}
                    if (xOffset > plotWidth - (7.5 * hoverText.text().length)) xHoverOffset -= (7.5 * hoverText.text().length);
                    if (yOffset < 30) yHoverOffset += 30;
                    hoverPoint.style('fill', color).attr("cx", xOffset).attr("cy", yOffset);
                    hoverText.style('fill', color)
                        .attr("x", xOffset + xHoverOffset)
                        .attr("y", yOffset + yHoverOffset);
                    
                    hoverContainer.call(hoverCurve.value(utility));
                    hoverContainer.attr("visibility", "visible");
                    
                    if (!$scope.config.showThermometer) return;
                    redrawThermometer();
                    var c = $('#thermometer')[0];
                    var ctx = c.getContext("2d");
                    var utilityAlloc = $scope.config.utilityFunction(alloc.x, alloc.y),
                        utilityHover = $scope.config.utilityFunction(hover.x, hover.y);
                    var minUtility = d3.min(utilityGrid, function(col) { return d3.min(col); }),
                        maxUtility = d3.max(utilityGrid, function(col) { return d3.max(col); });
                    var posAlloc = (utilityAlloc / (maxUtility - minUtility)) * (c.width-22) + 11,
                        posHover = (utilityHover / (maxUtility - minUtility)) * (c.width-22) + 11;
                    ctx.lineWidth = 3;
                    ctx.beginPath();
                    ctx.moveTo(posAlloc, 0);
                    ctx.lineTo(posAlloc, c.height/2);
                    ctx.strokeStyle = 'black';
                    ctx.stroke();
                    if (acceptingOffer) {
                        if (hover.x > alloc.x) {
                            ctx.fillStyle = 'green';
                            ctx.fillRect(posAlloc, 0, posHover-posAlloc, c.height/2);
                        } else {
                            ctx.fillStyle = 'red';
                            ctx.fillRect(posHover, 0, posAlloc-posHover, c.height/2);
                        }
                    }
                    ctx.beginPath();
                    ctx.moveTo(posHover, 0);
                    ctx.lineTo(posHover, c.height/2);
                    ctx.strokeStyle = color;
                    ctx.stroke();
                }
            }
            
            function validAreaHovered(hover_ori) {
                var hover = {x: hover_ori.x * currentScale, y: hover_ori.y * currentScale};
                var x = hover.x, y = hover.y, bids = $scope.bidProjections, asks = $scope.askProjections, alloc = $scope.allocation, type;
                if (!alloc) return;
                var ask_points = askProjectionContainer.selectAll('.projection-point').data(asks || []);
                    ask_points.style('fill', 'green');
                var bid_points = bidProjectionContainer.selectAll('.projection-point').data(bids || []);
                    bid_points.style('fill', 'red');
                if (x < alloc.x && y > alloc.y) {
                    type = 'bid';
                    if ($scope.config.highlightInsertionPoint) {
                        insertionIndex = -1;
                        for (var i = 0; i < asks.length; i++) { if (getPrice(asks[i],alloc) < getPrice(hover, alloc)) { insertionIndex = i; break; } }
                        if (insertionIndex == -1) { insertionIndex = asks.length; }
                        if (insertionIndex > 0) d3.select(ask_points[0][insertionIndex-1]).style('fill', 'yellow');
                    }
                    return getPartial(type, alloc, hover, bids);
                } else if (x > alloc.x && y < alloc.y) {
                    type = 'ask';
                    if ($scope.config.highlightInsertionPoint) {
                        insertionIndex = -1;
                        for (var i = 0; i < bids.length; i++) { if (getPrice(bids[i],alloc) > getPrice(hover, alloc)) { insertionIndex = i; break; } }
                        if (insertionIndex == -1) { insertionIndex = bids.length; }
                        if (insertionIndex > 0) d3.select(bid_points[0][insertionIndex-1]).style('fill', 'yellow');
                    }
                    return getPartial(type, alloc, hover, asks);
                } else return {x: hover.x,y: hover.y, area:'invalidArea'};
            }
            
            function distance(a,b) {
                return Math.sqrt(Math.pow(a.x-b.x,2)+Math.pow(a.y-b.y,2));
            }
            
            function getPrice(a,b) {
                return (a.y-b.y)/(a.x-b.x);
            }
            
            function getPartial (type, alloc, hover, offers) {
                var x = 0, y = 0, current_price, previous_price, hover_price, previous_point = alloc, isBest = false;
                if (type == 'ask') {
                    if ($scope.bidProjections[0] && getPrice($scope.bidProjections[0], alloc) > getPrice(hover, alloc)) isBest = true;
                    else if (!$scope.bidProjections[0]) isBest = true;
                    for (var i = 0; i < offers.length; i++) {
                        previous_price = current_price;
                        current_price = getPrice(offers[i], previous_point);
                        hover_price = getPrice(previous_point, hover);
                        var y_snapped = previous_point.y + (hover.x - previous_point.x) * current_price;
                        if (!previous_price && hover_price > current_price) {
                            return {area: 'createOffer', x:hover.x, y:hover.y, isBest: isBest};
                        } else if (hover.y <= y_snapped && offers[i].x >= hover.x) {
                            var loc = (offers[i-1]) ? offers[i-1] : alloc; x = hover.x; y = y_snapped;
                            if (distance(offers[i],{x:x,y:y}) / distance(loc,offers[i]) <= 0.08) { x = offers[i].x; y = offers[i].y; }
                            return {area: 'acceptOffer', x:x, y:y, index: i};
                        /* >> Falcon's Convention << */
                        } else if ($scope.config.convention == 'marginal' && previous_price && current_price <= hover_price && hover_price <= previous_price) {
                            var part = (hover_price - previous_price) / (current_price - previous_price);
                            x = previous_point.x+Math.abs(previous_point.x-offers[i].x)*part;
                            y = previous_point.y-Math.abs(previous_point.y-offers[i].y)*part;
                            return {area: 'acceptOffer', x:x, y:y, index: i};
                        } else if (previous_price && getPrice(previous_point, hover) >= getPrice(previous_point, offers[i])) {
                            /* >> Blended Convention << */
                            if ($scope.config.convention == 'blended') {
                                x = ((offers[i].y-alloc.y)-current_price*(offers[i].x-alloc.x)) / (getPrice(hover, alloc) - current_price);
                                y = getPrice(hover, alloc) * x;
                                x+=alloc.x; y+=alloc.y;
                                if (x >= previous_point.x && x <= offers[i].x) return {area: 'acceptOffer', x:x, y:y, index: i};
                                else if (i == offers.length-1 && x >= offers[i].x) return {area: 'acceptOffer', x:offers[i].x, y:offers[i].y, index: i+1};
                            /* >> Sequential Convention << */
                            } else if ($scope.config.convention == 'sequential') {
                                var loc = (offers[i-1]) ? offers[i-1] : alloc; x = hover.x; y = y_snapped;
                                if (distance(offers[i],{x:x,y:y}) / distance(loc,offers[i]) <= 0.08) { x = offers[i].x; y = offers[i].y; }
                                if (x > offers[i].x) { x = previous_point.x+0.01; y = previous_point.y-0.01; }
                                return {area: 'acceptOffer', x:x, y:y, index: i};
                            }
                        } else if (i == offers.length-1 && offers[i].x <= hover.x) return {area: 'acceptOffer', x:offers[i].x, y:offers[i].y, index: i+1};
                        previous_point = offers[i];
                    }
                } else if (type == 'bid') {
                    if ($scope.askProjections[0] && getPrice($scope.askProjections[0], alloc) < getPrice(hover, alloc)) isBest = true;
                    else if (!$scope.askProjections[0]) isBest = true;
                    for (var i = 0; i < offers.length; i++) {
                        previous_price = current_price;
                        current_price = getPrice(offers[i], previous_point);
                        hover_price = getPrice(previous_point, hover);
                        var y_snapped = previous_point.y + (hover.x - previous_point.x) * current_price;
                        if (!previous_price && hover_price < current_price) {
                            return {area: 'createOffer', x:hover.x, y:hover.y, isBest: isBest};
                        } else if (hover.y <= y_snapped && offers[i].x <= hover.x) {
                            var loc = (offers[i-1]) ? offers[i-1] : alloc; x = hover.x; y = y_snapped;
                            if (distance(offers[i],{x:x,y:y}) / distance(loc,offers[i]) <= 0.08) { x = offers[i].x; y = offers[i].y; }
                            return {area: 'acceptOffer', x:x, y:y, index: i};
                        /* >> Falcon's Convention << */
                        } else if ($scope.config.convention == 'marginal' && previous_price && current_price <= hover_price && hover_price <= previous_price) {
                            var part = (hover_price - previous_price) / (current_price - previous_price);
                            x = previous_point.x+Math.abs(previous_point.x-offers[i].x)*part;
                            y = previous_point.y-Math.abs(previous_point.y-offers[i].y)*part;
                            return {area: 'acceptOffer', x:x, y:y, index: i};
                        } else if (previous_price && getPrice(previous_point, hover) <= getPrice(previous_point, offers[i])) {
                            /* >> Blended Convention << */
                            if ($scope.config.convention == 'blended') {
                                x = ((offers[i].y-alloc.y)-current_price*(offers[i].x-alloc.x)) / (getPrice(hover, alloc) - current_price);
                                y = getPrice(hover, alloc) * x;
                                x+=alloc.x; y+=alloc.y;
                                if (x <= previous_point.x && x >= offers[i].x) return {area: 'acceptOffer', x:x, y:y, index: i};
                                else if (i == offers.length-1 && x <= offers[i].x) return {area: 'acceptOffer', x:offers[i].x, y:offers[i].y, index: i+1};
                            /* >> Sequential Convention << */
                            } else if ($scope.config.convention == 'sequential') {
                                var loc = (offers[i-1]) ? offers[i-1] : alloc; x = hover.x; y = y_snapped;
                                if (distance(offers[i],{x:x,y:y}) / distance(loc,offers[i]) <= 0.08) { x = offers[i].x; y = offers[i].y; }
                                if (x < offers[i].x) { x = previous_point.x+0.01; y = previous_point.y-0.01; }
                                return {area: 'acceptOffer', x:x, y:y, index: i};
                            }
                        } else if (i == offers.length-1 && offers[i].x >= hover.x) return {area: 'acceptOffer', x:offers[i].x, y:offers[i].y, index: i+1};
                        previous_point = offers[i];
                    }
                }
                return {area: 'createOffer', x:hover.x, y:hover.y, isBest: isBest};
            }
        }
    };
}]);

Redwood
    .filter("offerType", function() {
        return function(offer) {
            if(angular.isUndefined(offer) || offer === null) {
                return "";
            }
            return (offer.qty > 0 ? "Bid" : "Ask");
        };
    });
    
(function()
{
    $.simplyToast = function(message, type, options)
    {
        options = $.extend(true, {}, $.simplyToast.defaultOptions, options);

        var html = '<div class="simply-toast alert alert-' + (type ? type : options.type) + ' ' + (options.customClass ? options.customClass : '') +'">';
            if(options.allowDismiss)
                html += '<span class="close" data-dismiss="alert">&times;</span>';
            html += message;
            html += '</div>';

        var offsetSum = options.offset.amount;
        if(!options.stack)
        {   $('.simply-toast').each(function()
            {
                return offsetSum = Math.max(offsetSum, parseInt($(this).css(options.offset.from)) + this.offsetHeight + options.spacing);
            });
        }
        else
        {
            $(options.appendTo).find('.simply-toast').each(function()
            {
                return offsetSum = Math.max(offsetSum, parseInt($(this).css(options.offset.from)) + this.offsetHeight + options.spacing);
            });
        }

        var css =
        {
            'position': (options.appendTo === 'body' ? 'fixed' : 'absolute'),
            'margin': 0,
            'z-index': '9999',
            'display': 'none',
            'min-width': options.minWidth,
            'max-width': options.maxWidth
        };

        css[options.offset.from] = offsetSum + 'px';

        var $alert = $(html).css(css)
                            .appendTo(options.appendTo);

        switch (options.align)
        {
            case "center":
                $alert.css(
                {
                    "left": "50%",
                    "margin-left": "-" + ($alert.outerWidth() / 2) + "px"
                });
                break;
            case "left":
                $alert.css("left", "20px");
                break;
            default:
                $alert.css("right", "20px");
        }
        
        if($alert.fadeIn) $alert.fadeIn();
        else $alert.css({display: 'block', opacity: 1});
        
        function removeAlert()
        {
            $.simplyToast.remove($alert);
        }

        if(options.delay > 0)
        {
            setTimeout(removeAlert, options.delay);
        }

        $alert.find("[data-dismiss=\"alert\"]").removeAttr('data-dismiss').click(removeAlert);

        return $alert;
    };

    $.simplyToast.remove = function($alert)
    {
        if($alert.fadeOut)
        {
            return $alert.fadeOut(function()
            {
                return $alert.remove();
            });
        }
        else
        {
            return $alert.remove();
        }
    };

    $.simplyToast.defaultOptions = {
        appendTo: "body",
        stack: false,
        customClass: false,
        type: "info",
        offset:
        {
            from: "top",
            amount: 20
        },
        align: "right",
        minWidth: 250,
        maxWidth: 450,
        delay: 4000,
        allowDismiss: true,
        spacing: 10
    };
})();
