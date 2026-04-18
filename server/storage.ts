import { 
  users, type User, type InsertUser,
  nutritionLogs, type NutritionLog, type InsertNutritionLog,
  workoutLogs, type WorkoutLog, type InsertWorkoutLog,
  healthLogs, type HealthLog, type InsertHealthLog,
  dailyPlans, type DailyPlan, type InsertDailyPlan
} from "@shared/schema";
import { db } from "./db";
import { eq, and, sql } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, userData: Partial<User>): Promise<User | undefined>;
  
  // Nutrition log methods
  getNutritionLogs(userId: number): Promise<NutritionLog[]>;
  getNutritionLogByDate(userId: number, date: Date): Promise<NutritionLog | undefined>;
  getNutritionLogsByDate(userId: number, date: Date): Promise<NutritionLog[]>;
  getNutritionLogById(id: number): Promise<NutritionLog | undefined>;
  createNutritionLog(log: InsertNutritionLog): Promise<NutritionLog>;
  updateNutritionLog(id: number, logData: Partial<NutritionLog>): Promise<NutritionLog | undefined>;
  deleteNutritionLog(id: number): Promise<boolean>;
  
  // Workout log methods
  getWorkoutLogs(userId: number): Promise<WorkoutLog[]>;
  getWorkoutLogByDate(userId: number, date: Date): Promise<WorkoutLog | undefined>;
  createWorkoutLog(log: InsertWorkoutLog): Promise<WorkoutLog>;
  updateWorkoutLog(id: number, logData: Partial<WorkoutLog>): Promise<WorkoutLog | undefined>;
  
  // Health log methods
  getHealthLogs(userId: number): Promise<HealthLog[]>;
  getHealthLogByDate(userId: number, date: Date): Promise<HealthLog | undefined>;
  createHealthLog(log: InsertHealthLog): Promise<HealthLog>;
  updateHealthLog(id: number, logData: Partial<HealthLog>): Promise<HealthLog | undefined>;
  
  // Daily plan methods
  getDailyPlans(userId: number): Promise<DailyPlan[]>;
  getDailyPlanByDate(userId: number, date: Date): Promise<DailyPlan | undefined>;
  createDailyPlan(plan: InsertDailyPlan): Promise<DailyPlan>;
  updateDailyPlan(id: number, planData: Partial<DailyPlan>): Promise<DailyPlan | undefined>;
  
  // Session store
  sessionStore: session.Store;
}

// Configure PostgreSQL session store
const PostgresSessionStore = connectPg(session);

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = new PostgresSessionStore({
      pool,
      createTableIfMissing: true
    });
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUser(id: number, userData: Partial<User>): Promise<User | undefined> {
    const [updatedUser] = await db
      .update(users)
      .set(userData)
      .where(eq(users.id, id))
      .returning();
    return updatedUser;
  }

  // Nutrition log methods
  async getNutritionLogs(userId: number): Promise<NutritionLog[]> {
    return await db
      .select()
      .from(nutritionLogs)
      .where(eq(nutritionLogs.userId, userId));
  }

  async getNutritionLogByDate(userId: number, date: Date): Promise<NutritionLog | undefined> {
    const dateString = date.toISOString().split('T')[0];
    // Use SQL template for date comparison
    const [log] = await db
      .select()
      .from(nutritionLogs)
      .where(
        and(
          eq(nutritionLogs.userId, userId),
          sql`${nutritionLogs.date}::date = ${dateString}::date`
        )
      );
    return log;
  }

  async getNutritionLogsByDate(userId: number, date: Date): Promise<NutritionLog[]> {
    const dateString = date.toISOString().split('T')[0];
    const logs = await db
      .select()
      .from(nutritionLogs)
      .where(
        and(
          eq(nutritionLogs.userId, userId),
          sql`${nutritionLogs.date}::date = ${dateString}::date`
        )
      );
    return logs;
  }

  async createNutritionLog(insertLog: InsertNutritionLog): Promise<NutritionLog> {
    const [log] = await db
      .insert(nutritionLogs)
      .values(insertLog)
      .returning();
    return log;
  }

  async updateNutritionLog(id: number, logData: Partial<NutritionLog>): Promise<NutritionLog | undefined> {
    const [updatedLog] = await db
      .update(nutritionLogs)
      .set(logData)
      .where(eq(nutritionLogs.id, id))
      .returning();
    return updatedLog;
  }

  async getNutritionLogById(id: number): Promise<NutritionLog | undefined> {
    const [log] = await db
      .select()
      .from(nutritionLogs)
      .where(eq(nutritionLogs.id, id));
    return log;
  }

  async deleteNutritionLog(id: number): Promise<boolean> {
    const result = await db
      .delete(nutritionLogs)
      .where(eq(nutritionLogs.id, id))
      .returning({ id: nutritionLogs.id });
    return result.length > 0;
  }

  // Workout log methods
  async getWorkoutLogs(userId: number): Promise<WorkoutLog[]> {
    return await db
      .select()
      .from(workoutLogs)
      .where(eq(workoutLogs.userId, userId));
  }

  async getWorkoutLogByDate(userId: number, date: Date): Promise<WorkoutLog | undefined> {
    const dateString = date.toISOString().split('T')[0];
    const [log] = await db
      .select()
      .from(workoutLogs)
      .where(
        and(
          eq(workoutLogs.userId, userId),
          sql`${workoutLogs.date}::date = ${dateString}::date`
        )
      );
    return log;
  }

  async createWorkoutLog(insertLog: InsertWorkoutLog): Promise<WorkoutLog> {
    const [log] = await db
      .insert(workoutLogs)
      .values(insertLog)
      .returning();
    return log;
  }

  async updateWorkoutLog(id: number, logData: Partial<WorkoutLog>): Promise<WorkoutLog | undefined> {
    const [updatedLog] = await db
      .update(workoutLogs)
      .set(logData)
      .where(eq(workoutLogs.id, id))
      .returning();
    return updatedLog;
  }

  // Health log methods
  async getHealthLogs(userId: number): Promise<HealthLog[]> {
    return await db
      .select()
      .from(healthLogs)
      .where(eq(healthLogs.userId, userId));
  }

  async getHealthLogByDate(userId: number, date: Date): Promise<HealthLog | undefined> {
    const dateString = date.toISOString().split('T')[0];
    const [log] = await db
      .select()
      .from(healthLogs)
      .where(
        and(
          eq(healthLogs.userId, userId),
          sql`${healthLogs.date}::date = ${dateString}::date`
        )
      );
    return log;
  }

  async createHealthLog(insertLog: InsertHealthLog): Promise<HealthLog> {
    const [log] = await db
      .insert(healthLogs)
      .values(insertLog)
      .returning();
    return log;
  }

  async updateHealthLog(id: number, logData: Partial<HealthLog>): Promise<HealthLog | undefined> {
    const [updatedLog] = await db
      .update(healthLogs)
      .set(logData)
      .where(eq(healthLogs.id, id))
      .returning();
    return updatedLog;
  }

  // Daily plan methods
  async getDailyPlans(userId: number): Promise<DailyPlan[]> {
    return await db
      .select()
      .from(dailyPlans)
      .where(eq(dailyPlans.userId, userId));
  }

  async getDailyPlanByDate(userId: number, date: Date): Promise<DailyPlan | undefined> {
    const dateString = date.toISOString().split('T')[0];
    const [plan] = await db
      .select()
      .from(dailyPlans)
      .where(
        and(
          eq(dailyPlans.userId, userId),
          sql`${dailyPlans.date}::date = ${dateString}::date`
        )
      );
    return plan;
  }

  async createDailyPlan(insertPlan: InsertDailyPlan): Promise<DailyPlan> {
    const [plan] = await db
      .insert(dailyPlans)
      .values(insertPlan)
      .returning();
    return plan;
  }

  async updateDailyPlan(id: number, planData: Partial<DailyPlan>): Promise<DailyPlan | undefined> {
    const [updatedPlan] = await db
      .update(dailyPlans)
      .set(planData)
      .where(eq(dailyPlans.id, id))
      .returning();
    return updatedPlan;
  }
}

// Create and export an instance of DatabaseStorage
export const storage = new DatabaseStorage();
