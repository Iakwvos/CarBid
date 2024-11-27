using Microsoft.EntityFrameworkCore;
using CarBid.Application.Interfaces;
using CarBid.Infrastructure.Data;
using System.Collections.Generic;
using System.Threading.Tasks;
using System.Linq.Expressions;
using Microsoft.Extensions.Logging;

namespace CarBid.Infrastructure.Repositories
{
    public class Repository<T> : IRepository<T> where T : class
    {
        private readonly ApplicationDbContext _context;
        private readonly ILogger<Repository<T>> _logger;
        private readonly DbSet<T> _dbSet;

        public Repository(ApplicationDbContext context, ILogger<Repository<T>> logger)
        {
            _context = context ?? throw new ArgumentNullException(nameof(context));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
            _dbSet = _context.Set<T>();
        }

        public async Task<IEnumerable<T>> GetAllAsync()
        {
            try
            {
                _logger.LogInformation($"Getting all entities of type {typeof(T).Name}");
                return await _dbSet.ToListAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error retrieving entities of type {typeof(T).Name}");
                throw;
            }
        }

        public async Task<T?> GetByIdAsync(int id)
        {
            try
            {
                _logger.LogInformation($"Getting entity of type {typeof(T).Name} with id {id}");
                return await _dbSet.FindAsync(id);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error retrieving entity of type {typeof(T).Name} with id {id}");
                throw;
            }
        }

        public async Task<IEnumerable<T>> GetAllWithIncludesAsync(params Expression<Func<T, object>>[] includes)
        {
            try
            {
                _logger.LogInformation($"Getting all entities of type {typeof(T).Name} with includes");
                
                IQueryable<T> query = _dbSet;
                
                foreach (var include in includes)
                {
                    query = query.Include(include);
                }
                
                return await query.ToListAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error retrieving entities of type {typeof(T).Name} with includes");
                throw;
            }
        }

        public async Task<T> AddAsync(T entity)
        {
            try
            {
                _logger.LogInformation($"Adding new entity of type {typeof(T).Name}");
                await _dbSet.AddAsync(entity);
                await _context.SaveChangesAsync();
                return entity;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error adding entity of type {typeof(T).Name}");
                throw;
            }
        }

        public async Task UpdateAsync(T entity)
        {
            try
            {
                _logger.LogInformation($"Updating entity of type {typeof(T).Name}");
                _dbSet.Update(entity);
                await _context.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error updating entity of type {typeof(T).Name}");
                throw;
            }
        }

        public async Task DeleteAsync(T entity)
        {
            _context.Set<T>().Remove(entity);
            await _context.SaveChangesAsync();
        }
    }
} 