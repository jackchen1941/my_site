#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
AWS EC2 管理工具 - 一个交互式命令行工具，用于管理AWS EC2实例
功能包括：
- 按区域查看EC2实例列表
- 对选定实例执行操作(启动、停止、终止、查看详情)
- 修改实例配置
- 导出实例详情到CSV文件
"""

import boto3
import sys
import os
import csv
import time
import json
import argparse
from datetime import datetime
from prettytable import PrettyTable
from botocore.exceptions import ClientError

# 帮助处理AWS API返回的类型
def json_serial(obj):
    """处理非JSON序列化对象"""
    if isinstance(obj, datetime):
        return obj.isoformat()
    raise TypeError(f"Type {type(obj)} not serializable")

class EC2Manager:
    def __init__(self, region=None):
        self.regions = []
        self.ec2_instances = []
        self._selected_region = None  # 使用私有变量
        self.ec2_client = None
        self.ec2_resource = None
        
        # 如果提供了初始区域，设置它
        if region:
            self.selected_region = region  # 使用property setter
        
    @property
    def selected_region(self):
        """获取当前选择的区域"""
        return self._selected_region
    
    @selected_region.setter
    def selected_region(self, region):
        """设置区域并重置实例列表和客户端"""
        # 如果区域发生变化
        if self._selected_region != region:
            self._selected_region = region
            # 清空实例列表缓存
            self.ec2_instances = []
            
            # 如果设置了新区域，初始化新客户端
            if region:
                self.ec2_client = boto3.client('ec2', region_name=region)
                self.ec2_resource = boto3.resource('ec2', region_name=region)
            else:
                self.ec2_client = None
                self.ec2_resource = None
        
    def initialize(self):
        """初始化AWS区域列表"""
        ec2 = boto3.client('ec2', region_name='us-east-1')  # 使用默认区域获取所有区域
        try:
            self.regions = [region['RegionName'] for region in ec2.describe_regions()['Regions']]
            print(f"成功获取 {len(self.regions)} 个AWS区域")
            
            # 如果已指定区域，初始化该区域的客户端
            if self.selected_region:
                if self.selected_region in self.regions:
                    print(f"✅ 使用指定区域: {self.selected_region}")
                    # 不需要再次设置，因为构造函数已经处理
                    return True
                else:
                    print(f"❌ 指定的区域 {self.selected_region} 不存在，请重新选择")
                    self.selected_region = None
            
            return True
        except ClientError as e:
            print(f"❌ 获取AWS区域失败: {e}")
            sys.exit(1)
    
    def select_region(self):
        """显示区域列表并让用户选择"""
        print("\n===== AWS区域列表 =====")
        table = PrettyTable()
        table.field_names = ["序号", "区域代码", "区域名称"]
        
        # 定义区域名称映射
        region_names = {
            "us-east-1": "美国东部 (弗吉尼亚北部)",
            "us-east-2": "美国东部 (俄亥俄)",
            "us-west-1": "美国西部 (加利福尼亚北部)",
            "us-west-2": "美国西部 (俄勒冈)",
            "ap-east-1": "亚太地区 (香港)",
            "ap-south-1": "亚太地区 (孟买)",
            "ap-northeast-1": "亚太地区 (东京)",
            "ap-northeast-2": "亚太地区 (首尔)",
            "ap-northeast-3": "亚太地区 (大阪)",
            "ap-southeast-1": "亚太地区 (新加坡)",
            "ap-southeast-2": "亚太地区 (悉尼)",
            "ca-central-1": "加拿大 (中部)",
            "eu-central-1": "欧洲 (法兰克福)",
            "eu-west-1": "欧洲 (爱尔兰)",
            "eu-west-2": "欧洲 (伦敦)",
            "eu-west-3": "欧洲 (巴黎)",
            "eu-north-1": "欧洲 (斯德哥尔摩)",
            "eu-south-1": "欧洲 (米兰)",
            "sa-east-1": "南美洲 (圣保罗)"
        }
        
        for idx, region in enumerate(self.regions, 1):
            region_name = region_names.get(region, "未知区域")
            table.add_row([idx, region, region_name])
        
        print(table)
        
        while True:
            try:
                choice = int(input("\n请选择一个区域 (输入序号): "))
                if 1 <= choice <= len(self.regions):
                    new_region = self.regions[choice-1]
                    
                    # 使用setter方法设置区域（会清除缓存）
                    self.selected_region = new_region
                    print(f"✅ 已选择区域: {self.selected_region}")
                    return True
                else:
                    print("❌ 无效的选择，请重试")
            except ValueError:
                print("❌ 请输入有效的数字")
    
    def get_instance_list(self, force_refresh=False):
        """获取所选区域的EC2实例列表"""
        if not self.ec2_client:
            print("❌ 请先选择一个区域")
            return False
        
        # 如果已有实例列表且不强制刷新，则直接返回
        if self.ec2_instances and not force_refresh:
            return True
        
        try:
            print(f"正在获取区域 {self.selected_region} 的实例列表...")
            response = self.ec2_client.describe_instances()
            instances = []
            
            for reservation in response['Reservations']:
                for instance in reservation['Instances']:
                    # 获取名称标签
                    name = "N/A"
                    if 'Tags' in instance:
                        for tag in instance['Tags']:
                            if tag['Key'] == 'Name':
                                name = tag['Value']
                                break
                    
                    # 获取公网IP和私网IP
                    public_ip = instance.get('PublicIpAddress', 'N/A')
                    private_ip = instance.get('PrivateIpAddress', 'N/A')
                    
                    # 获取终止保护状态
                    try:
                        termination_protection = self.ec2_client.describe_instance_attribute(
                            InstanceId=instance['InstanceId'],
                            Attribute='disableApiTermination'
                        ).get('DisableApiTermination', {}).get('Value', False)
                    except:
                        termination_protection = False
                    
                    # 实例详情
                    instance_info = {
                        'InstanceId': instance['InstanceId'],
                        'Name': name,
                        'State': instance['State']['Name'],
                        'InstanceType': instance['InstanceType'],
                        'PublicIp': public_ip,
                        'PrivateIp': private_ip,
                        'LaunchTime': instance['LaunchTime'],
                        'TerminationProtection': termination_protection,
                        'Details': instance  # 保存完整详情以供后续使用
                    }
                    instances.append(instance_info)
            
            self.ec2_instances = instances
            return len(instances) > 0
        except ClientError as e:
            print(f"❌ 获取实例列表失败: {e}")
            return False
    
    def show_instance_list(self):
        """显示EC2实例列表"""
        # 总是强制刷新实例列表
        if not self.get_instance_list(force_refresh=True):
            print(f"⚠️ 区域 {self.selected_region} 中没有找到EC2实例")
            return False
        
        print(f"\n===== {self.selected_region} 区域的EC2实例 =====")
        table = PrettyTable()
        table.field_names = ["序号", "实例ID", "名称", "状态", "类型", "公网IP", "私网IP", "终止保护", "启动时间"]
        
        for idx, instance in enumerate(self.ec2_instances, 1):
            launch_time = instance['LaunchTime'].strftime("%Y-%m-%d %H:%M:%S")
            
            # 设置状态颜色
            state = instance['State']
            if state == 'running':
                state = f"\033[92m{state}\033[0m"  # 绿色
            elif state == 'stopped':
                state = f"\033[91m{state}\033[0m"  # 红色
            elif state == 'pending' or state == 'stopping':
                state = f"\033[93m{state}\033[0m"  # 黄色
            
            # 设置终止保护颜色
            termination_protection = instance['TerminationProtection']
            if termination_protection:
                termination_protection = f"\033[92m是\033[0m"  # 绿色
            else:
                termination_protection = f"\033[91m否\033[0m"  # 红色
            
            table.add_row([
                idx, 
                instance['InstanceId'], 
                instance['Name'], 
                state,
                instance['InstanceType'], 
                instance['PublicIp'], 
                instance['PrivateIp'],
                termination_protection,
                launch_time
            ])
        
        print(table)
        return True
    
    def select_instance(self):
        """让用户选择一个实例"""
        if not self.show_instance_list():
            return None
        
        while True:
            try:
                choice = int(input("\n请选择一个实例 (输入序号，0返回): "))
                if choice == 0:
                    return None
                elif 1 <= choice <= len(self.ec2_instances):
                    return self.ec2_instances[choice-1]
                else:
                    print("❌ 无效的选择，请重试")
            except ValueError:
                print("❌ 请输入有效的数字")
    
    def instance_menu(self, instance):
        """显示对特定实例的操作菜单"""
        instance_id = instance['InstanceId']
        name = instance['Name']
        state = instance['State']
        
        while True:
            # 刷新实例状态
            self.refresh_instance(instance)
            state = instance['State']
            termination_protection = instance['TerminationProtection']
            
            print(f"\n===== 实例: {instance_id} ({name}) =====")
            print(f"状态: {state} | 终止保护: {'开启' if termination_protection else '关闭'}")
            print("\n1. 查看详情")
            print("2. 启动实例")
            print("3. 停止实例")
            print("4. 终止实例")
            print("5. 修改实例类型")
            print("6. 切换终止保护")
            print("0. 返回")
            
            try:
                choice = int(input("\n请选择操作: "))
                
                if choice == 0:
                    break
                elif choice == 1:
                    self.show_instance_details(instance)
                elif choice == 2:
                    self.start_instance(instance)
                elif choice == 3:
                    self.stop_instance(instance)
                elif choice == 4:
                    self.terminate_instance(instance)
                elif choice == 5:
                    self.modify_instance_type(instance)
                elif choice == 6:
                    self.toggle_termination_protection(instance)
                else:
                    print("❌ 无效的选择，请重试")
            except ValueError:
                print("❌ 请输入有效的数字")
    
    def refresh_instance(self, instance):
        """刷新实例状态"""
        try:
            # 获取基本信息
            response = self.ec2_client.describe_instances(InstanceIds=[instance['InstanceId']])
            for reservation in response['Reservations']:
                for updated_instance in reservation['Instances']:
                    instance['State'] = updated_instance['State']['Name']
                    
                    # 更新可能变更的属性
                    instance['InstanceType'] = updated_instance['InstanceType']
                    instance['PublicIp'] = updated_instance.get('PublicIpAddress', 'N/A')
                    instance['PrivateIp'] = updated_instance.get('PrivateIpAddress', 'N/A')
                    instance['Details'] = updated_instance  # 更新完整详情
            
            # 获取终止保护状态
            try:
                termination_protection = self.ec2_client.describe_instance_attribute(
                    InstanceId=instance['InstanceId'],
                    Attribute='disableApiTermination'
                ).get('DisableApiTermination', {}).get('Value', False)
                instance['TerminationProtection'] = termination_protection
            except:
                instance['TerminationProtection'] = False
                    
            return True
        except ClientError as e:
            print(f"❌ 刷新实例状态失败: {e}")
            return False
    
    def show_instance_details(self, instance):
        """显示实例的详细信息"""
        instance_id = instance['InstanceId']
        details = instance['Details']
        
        print(f"\n===== 实例详情: {instance_id} =====")
        
        # 基本信息
        print("\n== 基本信息 ==")
        print(f"名称: {instance['Name']}")
        print(f"状态: {instance['State']}")
        print(f"实例类型: {instance['InstanceType']}")
        print(f"AMI ID: {details['ImageId']}")
        print(f"启动时间: {instance['LaunchTime'].strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"终止保护: {'开启' if instance['TerminationProtection'] else '关闭'}")
        
        # 网络信息
        print("\n== 网络信息 ==")
        print(f"公网IP: {instance['PublicIp']}")
        print(f"私网IP: {instance['PrivateIp']}")
        print(f"子网ID: {details['SubnetId']}")
        print(f"VPC ID: {details['VpcId']}")
        
        # 安全组
        print("\n== 安全组 ==")
        for sg in details['SecurityGroups']:
            print(f"- {sg['GroupId']} ({sg['GroupName']})")
        
        # 存储信息
        print("\n== 存储信息 ==")
        for volume in details['BlockDeviceMappings']:
            device = volume['DeviceName']
            vol_id = volume['Ebs']['VolumeId']
            
            # 获取卷详情
            try:
                vol_info = self.ec2_client.describe_volumes(VolumeIds=[vol_id])['Volumes'][0]
                size = vol_info['Size']
                vol_type = vol_info['VolumeType']
                print(f"- 设备: {device}, 卷ID: {vol_id}, 大小: {size}GB, 类型: {vol_type}")
            except:
                print(f"- 设备: {device}, 卷ID: {vol_id}")
        
        # 标签
        if 'Tags' in details:
            print("\n== 标签 ==")
            for tag in details['Tags']:
                print(f"- {tag['Key']}: {tag['Value']}")
        
        # IAM角色
        if 'IamInstanceProfile' in details:
            profile = details['IamInstanceProfile']
            print(f"\n== IAM实例配置文件 ==")
            print(f"- {profile.get('Arn', 'N/A')}")
        
        input("\n按Enter键继续...")
    
    def start_instance(self, instance):
        """启动实例"""
        instance_id = instance['InstanceId']
        
        if instance['State'] == 'running':
            print(f"⚠️ 实例 {instance_id} 已经在运行中")
            return
        
        confirm = input(f"确定要启动实例 {instance_id} 吗? (y/n): ")
        if confirm.lower() != 'y':
            print("操作已取消")
            return
        
        try:
            print(f"正在启动实例 {instance_id}...")
            self.ec2_client.start_instances(InstanceIds=[instance_id])
            
            # 等待实例状态更新
            self.wait_for_state(instance, 'running')
            print(f"✅ 实例 {instance_id} 已启动")
        except ClientError as e:
            print(f"❌ 启动实例失败: {e}")
    
    def stop_instance(self, instance):
        """停止实例"""
        instance_id = instance['InstanceId']
        
        if instance['State'] == 'stopped':
            print(f"⚠️ 实例 {instance_id} 已经停止")
            return
        
        confirm = input(f"确定要停止实例 {instance_id} 吗? (y/n): ")
        if confirm.lower() != 'y':
            print("操作已取消")
            return
        
        try:
            print(f"正在停止实例 {instance_id}...")
            self.ec2_client.stop_instances(InstanceIds=[instance_id])
            
            # 等待实例状态更新
            self.wait_for_state(instance, 'stopped')
            print(f"✅ 实例 {instance_id} 已停止")
        except ClientError as e:
            print(f"❌ 停止实例失败: {e}")
    
    def toggle_termination_protection(self, instance):
        """切换终止保护状态"""
        instance_id = instance['InstanceId']
        current_protection = instance['TerminationProtection']
        new_protection = not current_protection
        
        action = "开启" if new_protection else "关闭"
        confirm = input(f"确定要{action}实例 {instance_id} 的终止保护吗? (y/n): ")
        if confirm.lower() != 'y':
            print("操作已取消")
            return
        
        try:
            print(f"正在{action}终止保护...")
            self.ec2_client.modify_instance_attribute(
                InstanceId=instance_id,
                DisableApiTermination={
                    'Value': new_protection
                }
            )
            
            # 刷新实例状态
            self.refresh_instance(instance)
            print(f"✅ 终止保护已{action}")
        except ClientError as e:
            print(f"❌ 修改终止保护失败: {e}")
    
    def terminate_instance(self, instance):
        """终止实例"""
        instance_id = instance['InstanceId']
        
        if instance['State'] == 'terminated':
            print(f"⚠️ 实例 {instance_id} 已经终止")
            return
        
        # 检查终止保护
        if instance['TerminationProtection']:
            print(f"⚠️ 实例 {instance_id} 启用了终止保护，需要先禁用")
            disable_confirm = input("是否禁用终止保护并继续? (y/n): ")
            if disable_confirm.lower() != 'y':
                print("操作已取消")
                return
            
            try:
                print("正在禁用终止保护...")
                self.ec2_client.modify_instance_attribute(
                    InstanceId=instance_id,
                    DisableApiTermination={
                        'Value': False
                    }
                )
                # 更新状态
                instance['TerminationProtection'] = False
                print("✅ 终止保护已禁用")
            except ClientError as e:
                print(f"❌ 禁用终止保护失败: {e}")
                return
        
        # 确认终止操作
        confirm = input(f"⚠️ 警告: 终止操作不可逆! 确定要终止实例 {instance_id} 吗? (输入TERMINATE确认): ")
        if confirm != "TERMINATE":
            print("操作已取消")
            return
        
        try:
            print(f"正在终止实例 {instance_id}...")
            self.ec2_client.terminate_instances(InstanceIds=[instance_id])
            
            # 等待实例状态更新
            self.wait_for_state(instance, 'terminated')
            print(f"✅ 实例 {instance_id} 已终止")
        except ClientError as e:
            print(f"❌ 终止实例失败: {e}")
    
    def get_available_instance_types(self):
        """获取可用的实例类型列表"""
        # 通用实例
        general_purpose = [
            't2.nano', 't2.micro', 't2.small', 't2.medium', 't2.large', 't2.xlarge', 't2.2xlarge',
            't3.nano', 't3.micro', 't3.small', 't3.medium', 't3.large', 't3.xlarge', 't3.2xlarge',
            'm4.large', 'm4.xlarge', 'm4.2xlarge', 'm4.4xlarge', 'm4.10xlarge', 'm4.16xlarge',
            'm5.large', 'm5.xlarge', 'm5.2xlarge', 'm5.4xlarge', 'm5.8xlarge', 'm5.12xlarge', 'm5.16xlarge', 'm5.24xlarge'
        ]
        
        # 计算优化实例
        compute_optimized = [
            'c4.large', 'c4.xlarge', 'c4.2xlarge', 'c4.4xlarge', 'c4.8xlarge',
            'c5.large', 'c5.xlarge', 'c5.2xlarge', 'c5.4xlarge', 'c5.9xlarge', 'c5.12xlarge', 'c5.18xlarge', 'c5.24xlarge'
        ]
        
        # 内存优化实例
        memory_optimized = [
            'r4.large', 'r4.xlarge', 'r4.2xlarge', 'r4.4xlarge', 'r4.8xlarge', 'r4.16xlarge',
            'r5.large', 'r5.xlarge', 'r5.2xlarge', 'r5.4xlarge', 'r5.8xlarge', 'r5.12xlarge', 'r5.16xlarge', 'r5.24xlarge'
        ]
        
        # 存储优化实例
        storage_optimized = [
            'i3.large', 'i3.xlarge', 'i3.2xlarge', 'i3.4xlarge', 'i3.8xlarge', 'i3.16xlarge',
            'd2.xlarge', 'd2.2xlarge', 'd2.4xlarge', 'd2.8xlarge'
        ]
        
        return {
            "通用型": general_purpose,
            "计算优化型": compute_optimized,
            "内存优化型": memory_optimized,
            "存储优化型": storage_optimized
        }
    
    def modify_instance_type(self, instance):
        """修改实例类型"""
        instance_id = instance['InstanceId']
        current_type = instance['InstanceType']
        
        print(f"\n当前实例类型: {current_type}")
        
        # 获取实例类型分类
        instance_types = self.get_available_instance_types()
        
        # 显示分类菜单
        print("\n请选择实例类型分类:")
        categories = list(instance_types.keys())
        for idx, category in enumerate(categories, 1):
            print(f"{idx}. {category}")
        
        # 选择分类
        while True:
            try:
                cat_choice = int(input("\n选择实例类型分类 (0取消): "))
                if cat_choice == 0:
                    print("操作已取消")
                    return
                elif 1 <= cat_choice <= len(categories):
                    selected_category = categories[cat_choice-1]
                    break
                else:
                    print("❌ 无效的选择，请重试")
            except ValueError:
                print("❌ 请输入有效的数字")
        
        # 显示该分类下的实例类型
        print(f"\n{selected_category}实例类型:")
        types_in_category = instance_types[selected_category]
        
        # 自定义输入选项
        print(f"{len(types_in_category) + 1}. 手动输入实例类型")
        
        for idx, itype in enumerate(types_in_category, 1):
            print(f"{idx}. {itype}")
        
        # 选择实例类型
        while True:
            try:
                type_choice = int(input("\n选择新的实例类型 (0取消): "))
                if type_choice == 0:
                    print("操作已取消")
                    return
                elif 1 <= type_choice <= len(types_in_category):
                    new_type = types_in_category[type_choice-1]
                    break
                elif type_choice == len(types_in_category) + 1:
                    # 手动输入
                    custom_type = input("请输入实例类型 (例如: t3.micro): ")
                    if custom_type.strip():
                        new_type = custom_type.strip()
                        break
                    else:
                        print("❌ 实例类型不能为空")
                else:
                    print("❌ 无效的选择，请重试")
            except ValueError:
                print("❌ 请输入有效的数字")
        
        if new_type == current_type:
            print(f"⚠️ 新类型与当前类型相同，操作取消")
            return
        
        confirm = input(f"确定要将实例 {instance_id} 的类型从 {current_type} 修改为 {new_type} 吗? (y/n): ")
        if confirm.lower() != 'y':
            print("操作已取消")
            return
        
        # 检查实例状态
        if instance['State'] != 'stopped':
            stop_confirm = input("⚠️ 修改实例类型需要先停止实例。是否继续? (y/n): ")
            if stop_confirm.lower() != 'y':
                print("操作已取消")
                return
            
            self.stop_instance(instance)
        
        try:
            print(f"正在修改实例类型为 {new_type}...")
            self.ec2_client.modify_instance_attribute(
                InstanceId=instance_id,
                InstanceType={'Value': new_type}
            )
            
            # 刷新实例
            self.refresh_instance(instance)
            print(f"✅ 实例类型已修改为 {new_type}")
            
            # 询问是否要启动实例
            start_confirm = input("是否要启动实例? (y/n): ")
            if start_confirm.lower() == 'y':
                self.start_instance(instance)
        except ClientError as e:
            print(f"❌ 修改实例类型失败: {e}")
    
    def wait_for_state(self, instance, target_state, timeout=300):
        """等待实例达到目标状态"""
        instance_id = instance['InstanceId']
        print(f"正在等待实例 {instance_id} 变为 {target_state} 状态...")
        
        start_time = time.time()
        while time.time() - start_time < timeout:
            self.refresh_instance(instance)
            current_state = instance['State']
            
            if current_state == target_state:
                return True
            
            # 检查是否为终止状态，避免无限等待
            if (target_state != 'terminated' and current_state == 'terminated'):
                print(f"⚠️ 实例已终止，无法达到 {target_state} 状态")
                return False
            
            time.sleep(5)  # 每5秒检查一次
        
        print(f"⚠️ 等待超时，实例当前状态: {instance['State']}")
        return False
    
    def export_to_csv(self):
        """导出EC2实例列表到CSV文件"""
        # 强制刷新实例列表
        if not self.get_instance_list(force_refresh=True):
            print(f"⚠️ 区域 {self.selected_region} 中没有找到EC2实例，无法导出")
            return
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"ec2_instances_{self.selected_region}_{timestamp}.csv"
        
        try:
            with open(filename, 'w', newline='', encoding='utf-8') as csvfile:
                writer = csv.writer(csvfile)
                
                # 写入标题行
                writer.writerow([
                    'Instance ID', 'Name', 'State', 'Instance Type', 
                    'Public IP', 'Private IP', 'Termination Protection', 'Launch Time', 
                    'AMI ID', 'VPC ID', 'Subnet ID'
                ])
                
                # 写入实例数据
                for instance in self.ec2_instances:
                    details = instance['Details']
                    writer.writerow([
                        instance['InstanceId'],
                        instance['Name'],
                        instance['State'],
                        instance['InstanceType'],
                        instance['PublicIp'],
                        instance['PrivateIp'],
                        "Yes" if instance['TerminationProtection'] else "No",
                        instance['LaunchTime'].strftime("%Y-%m-%d %H:%M:%S"),
                        details['ImageId'],
                        details.get('VpcId', 'N/A'),
                        details.get('SubnetId', 'N/A')
                    ])
                
                print(f"✅ 实例列表已导出到 {filename}")
        except Exception as e:
            print(f"❌ 导出失败: {e}")


def parse_arguments():
    """解析命令行参数"""
    parser = argparse.ArgumentParser(description='AWS EC2 实例管理工具')
    parser.add_argument('--region', type=str, help='指定 AWS 区域 (例如: us-east-1)')
    return parser.parse_args()


def main():
    """主程序"""
    # 解析命令行参数
    args = parse_arguments()
    
    # 清屏
    os.system('cls' if os.name == 'nt' else 'clear')
    
    print("=" * 60)
    print("              AWS EC2 实例管理工具 v1.2")
    print("=" * 60)
    
    manager = EC2Manager(region=args.region)
    
    try:
        # 初始化区域列表
        manager.initialize()
        
        while True:
            # 如果尚未选择区域，则显示区域菜单
            if not manager.selected_region:
                if not manager.select_region():
                    break
            
            # 显示主菜单
            print("\n===== 主菜单 =====")
            print(f"当前区域: {manager.selected_region}")
            print("1. 查看实例列表")
            print("2. 选择一个实例进行操作")
            print("3. 导出实例列表到CSV")
            print("4. 切换区域")
            print("0. 退出")
            
            try:
                choice = int(input("\n请选择操作: "))
                
                if choice == 0:
                    break
                elif choice == 1:
                    manager.show_instance_list()
                elif choice == 2:
                    instance = manager.select_instance()
                    if instance:
                        manager.instance_menu(instance)
                elif choice == 3:
                    manager.export_to_csv()
                elif choice == 4:
                    manager.selected_region = None  # 使用setter方法清除缓存
                else:
                    print("❌ 无效的选择，请重试")
            except ValueError:
                print("❌ 请输入有效的数字")
    except KeyboardInterrupt:
        print("\n\n程序已中断")
    except Exception as e:
        print(f"\n❌ 发生错误: {e}")
    
    print("\n感谢使用AWS EC2实例管理工具!")


if __name__ == "__main__":
    main()