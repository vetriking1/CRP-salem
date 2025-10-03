import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Users, Plus, Search, Mail, Shield } from "lucide-react";

interface Team {
  id: string;
  name: string;
  description: string;
  manager_id: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  manager?: User;
  members?: TeamMember[];
}

interface User {
  id: string;
  email: string;
  full_name: string;
  role: string;
  avatar_url: string;
  is_active: boolean;
}

interface TeamMember {
  id: string;
  team_id: string;
  user_id: string;
  joined_at: string;
  user?: User;
}

export default function Teams() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const fetchTeams = async () => {
      setLoading(true);

      try {
        // Fetch teams with manager information
        const { data: teamsData, error: teamsError } = await supabase
          .from("teams")
          .select(
            `
            *,
            users:manager_id(id, full_name, email, role, avatar_url)
          `
          )
          .eq("is_active", true)
          .order("name");

        if (teamsError) throw teamsError;

        // For each team, fetch its members
        const teamsWithMembers = await Promise.all(
          (teamsData || []).map(async (team) => {
            // First, get the team member IDs
            const { data: memberIds, error: memberIdsError } = await supabase
              .from("team_members")
              .select("user_id")
              .eq("team_id", team.id);

            if (memberIdsError) throw memberIdsError;

            // If there are no members, return the team with empty members array
            if (!memberIds || memberIds.length === 0) {
              return {
                ...team,
                members: [],
              };
            }

            // Extract user IDs
            const userIds = memberIds.map((m) => m.user_id);

            // Then, fetch the user details for all members
            const { data: usersData, error: usersError } = await supabase
              .from("users")
              .select("id, full_name, email, role, avatar_url")
              .in("id", userIds)
              .eq("is_active", true);

            if (usersError) throw usersError;

            // Combine team members with user data
            const members = memberIds.map((member) => {
              const user = usersData?.find((u) => u.id === member.user_id);
              return {
                id: member.user_id,
                team_id: team.id,
                user_id: member.user_id,
                joined_at: new Date().toISOString(), // Default value since we don't have it
                user: user || undefined,
              };
            });

            return {
              ...team,
              members: members,
            };
          })
        );

        setTeams(teamsWithMembers);
      } catch (error) {
        console.error("Error fetching teams:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTeams();
  }, []);

  const filteredTeams = teams.filter(
    (team) =>
      team.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (team.description &&
        team.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (team.manager &&
        team.manager.full_name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const getRoleColor = (role: string) => {
    switch (role) {
      case "admin":
        return "bg-red-100 text-red-800";
      case "manager":
        return "bg-blue-100 text-blue-800";
      case "supervisor":
        return "bg-purple-100 text-purple-800";
      case "employee":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getWorkloadPercentage = (current: number, max: number) => {
    if (!max || max === 0) return 0;
    return Math.round((current / max) * 100);
  };

  const getWorkloadColor = (percentage: number) => {
    if (percentage >= 90) return "bg-red-500";
    if (percentage >= 70) return "bg-yellow-500";
    return "bg-green-500";
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Teams</h1>
          <p className="text-muted-foreground">
            Manage teams and their members
          </p>
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search teams..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-6">
        {filteredTeams.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Users className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No teams found</h3>
              <p className="text-muted-foreground text-center mt-2">
                {searchTerm
                  ? "Try adjusting your search terms"
                  : "Get started by creating your first team"}
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredTeams.map((team) => (
            <Card key={team.id} className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-xl">{team.name}</CardTitle>
                    {team.description && (
                      <p className="text-muted-foreground mt-1">
                        {team.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {team.manager && (
                      <div className="flex items-center gap-2 text-sm">
                        <Shield className="h-4 w-4 text-muted-foreground" />
                        <span>Manager: {team.manager.full_name}</span>
                      </div>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium">
                      Team Members ({team.members ? team.members.length : 0})
                    </h3>
                  </div>

                  {team.members && team.members.length > 0 ? (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {team.members.map((member) => (
                        <div
                          key={member.id}
                          className="flex items-center space-x-3 p-3 rounded-lg border"
                        >
                          <Avatar>
                            <AvatarImage
                              src={member.user?.avatar_url || ""}
                              alt={member.user?.full_name || ""}
                            />
                            <AvatarFallback>
                              {member.user?.full_name
                                ? member.user.full_name
                                    .split(" ")
                                    .map((n) => n[0])
                                    .join("")
                                    .toUpperCase()
                                : "U"}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium truncate">
                                {member.user?.full_name || "Unknown User"}
                              </p>
                              <Badge
                                className={`text-xs ${getRoleColor(
                                  member.user?.role || ""
                                )}`}
                              >
                                {member.user?.role || "No Role"}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <Mail className="h-3 w-3 text-muted-foreground" />
                              <p className="text-xs text-muted-foreground truncate">
                                {member.user?.email || "No email"}
                              </p>
                            </div>
                            {/* {member.user?.specialty && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Specialty: {member.user.specialty}
                              </p>
                            )} */}
                            <div className="mt-2">
                              {/* <div className="flex justify-between text-xs mb-1">
                                <span>Workload</span>
                                <span>
                                  {member.user?.current_workload_hours || 0}h /{" "}
                                  {member.user?.max_capacity_hours || 40}h
                                </span>
                              </div> */}
                              {/* <div className="w-full bg-gray-200 rounded-full h-1.5">
                                <div
                                  className={`h-1.5 rounded-full ${getWorkloadColor(
                                    getWorkloadPercentage(
                                      member.user?.current_workload_hours || 0,
                                      member.user?.max_capacity_hours || 40
                                    )
                                  )}`}
                                  style={{
                                    width: `${getWorkloadPercentage(
                                      member.user?.current_workload_hours || 0,
                                      member.user?.max_capacity_hours || 40
                                    )}%`
                                  }}
                                ></div>
                              </div> */}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-muted-foreground">
                      No members in this team yet
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
