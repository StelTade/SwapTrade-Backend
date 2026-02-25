# SwapTrade Backend Runbooks

## Table of Contents
- [High Error Rate](#high-error-rate)
- [High Latency](#high-latency)
- [Database Connection Failure](#database-connection-failure)
- [High Memory Usage](#high-memory-usage)
- [High CPU Usage](#high-cpu-usage)
- [Queue Backlog](#queue-backlog)
- [Low Trading Volume](#low-trading-volume)
- [Service Unavailable](#service-unavailable)
- [SLO Violations](#slo-violations)
- [No Active Users](#no-active-users)
- [Fee Progression System Inactive](#fee-progression-system-inactive)

---

## High Error Rate

### Alert
**High Error Rate** - Error rate is > 5% for the last 5 minutes

### Severity
Critical

### Symptoms
- 5xx error rate > 5%
- Users experiencing errors
- Service may be partially unavailable

### Possible Causes
1. **Database connectivity issues**
   - Database server down
   - Network connectivity problems
   - Database connection pool exhaustion

2. **External service failures**
   - Payment gateway issues
   - Blockchain node problems
   - Third-party API failures

3. **Application bugs**
   - Recent deployment issues
   - Memory leaks
   - Resource exhaustion

### Diagnosis Steps
1. Check application logs for error patterns
2. Verify database connectivity: `curl http://localhost:3000/health`
3. Check external service status
4. Review recent deployments
5. Monitor system resources

### Resolution Steps
1. **Database Issues**
   ```bash
   # Check database status
   docker-compose ps database
   
   # Restart database if needed
   docker-compose restart database
   
   # Check connection pool
   curl http://localhost:3000/metrics | grep database
   ```

2. **External Service Issues**
   - Check service status pages
   - Verify API keys and credentials
   - Consider fallback mechanisms

3. **Application Issues**
   ```bash
   # Rollback recent deployment
   kubectl rollout undo deployment/swaptrade-backend
   
   # Scale up if resource exhaustion
   kubectl scale deployment swaptrade-backend --replicas=5
   ```

### Prevention
- Implement circuit breakers for external services
- Add database connection monitoring
- Set up automated rollback on deployment failures
- Implement proper error handling and retry logic

---

## High Latency

### Alert
**High Latency** - 95th percentile latency > 1s

### Severity
Warning

### Symptoms
- Slow API responses
- Poor user experience
- Timeouts in client applications

### Possible Causes
1. **Database performance issues**
   - Slow queries
   - Missing indexes
   - Database lock contention

2. **Resource constraints**
   - High CPU usage
   - Memory pressure
   - Network latency

3. **External service delays**
   - Slow blockchain responses
   - Payment processing delays

### Diagnosis Steps
1. Check latency metrics: `curl http://localhost:3000/metrics | grep http_request_duration`
2. Analyze slow queries in database logs
3. Monitor system resources
4. Check external service response times

### Resolution Steps
1. **Database Optimization**
   ```sql
   -- Identify slow queries
   SELECT query, mean_time, calls FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;
   
   -- Add missing indexes
   CREATE INDEX CONCURRENTLY idx_trades_user_id ON trades(user_id);
   ```

2. **Resource Scaling**
   ```bash
   # Scale up resources
   kubectl patch deployment swaptrade-backend -p '{"spec":{"template":{"spec":{"containers":[{"name":"app","resources":{"limits":{"cpu":"1000m","memory":"2Gi"}}}]}}}}'
   ```

3. **Caching Strategy**
   - Implement Redis caching for frequently accessed data
   - Add CDN for static assets
   - Optimize database queries

### Prevention
- Regular database performance tuning
- Implement comprehensive caching
- Set up performance monitoring and alerts
- Conduct load testing

---

## Database Connection Failure

### Alert
**Database Connection Failure** - Database is not responding

### Severity
Critical

### Symptoms
- All database operations failing
- Service completely unavailable
- Connection timeout errors

### Possible Causes
1. **Database server down**
2. **Network connectivity issues**
3. **Database configuration errors**
4. **Connection pool exhaustion**

### Diagnosis Steps
1. Check database process: `ps aux | grep postgres`
2. Test connectivity: `nc -zv database-host 5432`
3. Review database logs
4. Check connection pool metrics

### Resolution Steps
1. **Restart Database**
   ```bash
   # For Docker
   docker-compose restart database
   
   # For Kubernetes
   kubectl rollout restart statefulset/database
   ```

2. **Fix Network Issues**
   - Check firewall rules
   - Verify DNS resolution
   - Test network connectivity

3. **Connection Pool Adjustment**
   ```yaml
   # Increase pool size in configuration
   database:
     pool:
       max: 20
       min: 5
   ```

### Prevention
- Implement database health checks
- Set up connection monitoring
- Configure automatic failover
- Regular backup and recovery testing

---

## High Memory Usage

### Alert
**High Memory Usage** - Memory usage > 85%

### Severity
Warning

### Symptoms
- Slow application performance
- Out of memory errors
- Increased swap usage

### Possible Causes
1. **Memory leaks**
2. **Insufficient resources**
3. **Large data processing**
4. **Cache bloat**

### Diagnosis Steps
1. Check memory metrics: `curl http://localhost:3000/metrics | grep memory`
2. Analyze memory usage patterns
3. Check for memory leaks in application logs
4. Review recent code changes

### Resolution Steps
1. **Scale Resources**
   ```bash
   # Increase memory limits
   kubectl patch deployment swaptrade-backend -p '{"spec":{"template":{"spec":{"containers":[{"name":"app","resources":{"limits":{"memory":"4Gi"}}}]}}}}'
   ```

2. **Memory Leak Investigation**
   ```bash
   # Generate heap dump
   kill -USR1 <pid>
   
   # Analyze with heapdump
   node --inspect heapdump.js
   ```

3. **Cache Management**
   - Clear unnecessary caches
   - Implement cache eviction policies
   - Optimize cache size

### Prevention
- Regular memory profiling
- Implement memory monitoring
- Set up automated scaling based on memory usage
- Conduct load testing

---

## High CPU Usage

### Alert
**High CPU Usage** - CPU usage > 80%

### Severity
Warning

### Symptoms
- Slow response times
- High latency
- System unresponsiveness

### Possible Causes
1. **High traffic load**
2. **Inefficient algorithms**
3. **Resource-intensive operations**
4. **External service polling**

### Diagnosis Steps
1. Check CPU metrics: `curl http://localhost:3000/metrics | grep cpu`
2. Analyze CPU usage by process
3. Review application performance
4. Check for infinite loops

### Resolution Steps
1. **Scale Horizontally**
   ```bash
   # Add more replicas
   kubectl scale deployment swaptrade-backend --replicas=10
   ```

2. **Optimize Code**
   - Profile CPU-intensive functions
   - Implement efficient algorithms
   - Add caching for expensive operations

3. **Load Balancing**
   - Distribute load across instances
   - Implement rate limiting
   - Optimize database queries

### Prevention
- Implement auto-scaling policies
- Regular performance profiling
- Set up CPU monitoring alerts
- Conduct capacity planning

---

## Queue Backlog

### Alert
**Queue Backlog** - Queue size > 1000 items

### Severity
Warning

### Symptoms
- Delayed message processing
- Increased queue size
- Processing delays

### Possible Causes
1. **High message volume**
2. **Slow consumers**
3. **Consumer failures**
4. **Resource constraints**

### Diagnosis Steps
1. Check queue metrics: `curl http://localhost:3000/metrics | grep queue`
2. Monitor consumer performance
3. Check for consumer errors
4. Analyze message patterns

### Resolution Steps
1. **Scale Consumers**
   ```bash
   # Increase consumer instances
   kubectl scale deployment queue-consumer --replicas=5
   ```

2. **Optimize Processing**
   - Improve consumer efficiency
   - Implement batch processing
   - Add parallel processing

3. **Queue Management**
   - Prioritize critical messages
   - Implement dead letter queues
   - Add message expiration

### Prevention
- Monitor queue size trends
- Implement auto-scaling for consumers
- Set up queue monitoring alerts
- Regular performance testing

---

## Low Trading Volume

### Alert
**Low Trading Volume** - Trading volume < 100 XLM in 10 minutes

### Severity
Info

### Symptoms
- Unusually low trading activity
- Potential system issues
- Market anomalies

### Possible Causes
1. **Market conditions**
2. **System issues preventing trades**
3. **User interface problems**
4. **Network connectivity issues**

### Diagnosis Steps
1. Verify trading system functionality
2. Check user activity metrics
3. Review market data
4. Test trading functionality

### Resolution Steps
1. **System Verification**
   ```bash
   # Test trading endpoint
   curl -X POST http://localhost:3000/trading/swap -d '{"amount":100,"asset":"XLM"}'
   
   # Check trading logs
   kubectl logs deployment/swaptrade-backend | grep trading
   ```

2. **User Communication**
   - Notify users of any issues
   - Provide status updates
   - Offer support channels

### Prevention
- Implement synthetic trading tests
- Monitor user activity patterns
- Set up market condition alerts
- Regular system health checks

---

## Service Unavailable

### Alert
**Service Unavailable** - SwapTrade backend service is not responding

### Severity
Critical

### Symptoms
- All endpoints returning 503
- Health checks failing
- Complete service outage

### Possible Causes
1. **Application crash**
2. **Infrastructure failure**
3. **Deployment issues**
4. **Network problems**

### Diagnosis Steps
1. Check service status: `kubectl get pods`
2. Review application logs
3. Verify infrastructure health
4. Test network connectivity

### Resolution Steps
1. **Restart Service**
   ```bash
   # Restart deployment
   kubectl rollout restart deployment/swaptrade-backend
   
   # Check rollout status
   kubectl rollout status deployment/swaptrade-backend
   ```

2. **Rollback Deployment**
   ```bash
   # Rollback to previous version
   kubectl rollout undo deployment/swaptrade-backend
   ```

3. **Infrastructure Recovery**
   - Fix network issues
   - Restore failed components
   - Verify dependencies

### Prevention
- Implement health checks
- Set up automated recovery
- Monitor service availability
- Regular disaster recovery testing

---

## SLO Violations

### Alert
**SLO Violation** - Service Level Objectives not being met

### Severity
Warning/Critical

### Symptoms
- Performance metrics below targets
- User experience degradation
- SLA breaches

### Possible Causes
1. **Performance degradation**
2. **Increased load**
3. **System changes**
4. **External factors**

### Diagnosis Steps
1. Review SLO metrics dashboard
2. Analyze performance trends
3. Identify bottlenecks
4. Check recent changes

### Resolution Steps
1. **Immediate Mitigation**
   - Scale resources
   - Implement traffic shaping
   - Enable caching

2. **Root Cause Analysis**
   - Investigate performance issues
   - Review recent deployments
   - Analyze system changes

3. **Long-term Fixes**
   - Optimize performance
   - Increase capacity
   - Improve monitoring

### Prevention
- Continuous SLO monitoring
- Performance optimization
- Capacity planning
- Regular SLO reviews

---

## No Active Users

### Alert
**No Active Users** - No active users detected for 5 minutes

### Severity
Warning

### Symptoms
- Zero user activity
- Potential authentication issues
- Frontend problems

### Possible Causes
1. **Authentication failures**
2. **Frontend issues**
3. **Network problems**
4. **Scheduled maintenance**

### Diagnosis Steps
1. Check authentication system
2. Verify frontend functionality
3. Test user login flow
4. Review user activity logs

### Resolution Steps
1. **Authentication Fix**
   ```bash
   # Check auth service
   curl http://localhost:3000/auth/health
   
   # Restart auth service if needed
   kubectl rollout restart deployment/auth-service
   ```

2. **Frontend Verification**
   - Test user interface
   - Check API connectivity
   - Verify deployment status

### Prevention
- Monitor user activity patterns
- Set up authentication monitoring
- Implement synthetic user tests
- Regular frontend health checks

---

## Fee Progression System Inactive

### Alert
**Fee Progression System Inactive** - No fee discounts applied in 2 hours

### Severity
Info

### Symptoms
- No achievement processing
- Fee discounts not updating
- User progression stalled

### Possible Causes
1. **Background job failures**
2. **Achievement system issues**
3. **Database problems**
4. **Configuration errors**

### Diagnosis Steps
1. Check achievement processing logs
2. Verify background job status
3. Test fee calculation endpoints
4. Review system configuration

### Resolution Steps
1. **Restart Background Jobs**
   ```bash
   # Restart job processor
   kubectl rollout restart deployment/job-processor
   
   # Check job queue
   kubectl get jobs
   ```

2. **System Verification**
   - Test achievement processing
   - Verify fee calculations
   - Check database connectivity

### Prevention
- Monitor background job health
- Set up achievement processing alerts
- Regular system testing
- Implement job retry mechanisms
